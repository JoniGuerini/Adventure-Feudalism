'use strict';
// Números grandes do jogo. O número comum do JavaScript (double) para em
// ~1,8e308 e vira Infinity; aqui nunca vira. São três faixas:
//  - abaixo de 1e300: um double comum (m, com e = 0), então as contas do
//    começo do jogo são exatamente as de sempre;
//  - até 10^(9e15): mantissa (1 <= |m| < 10) e expoente inteiro e, como na
//    break_infinity. É a faixa em que o jogo deve passar a maior parte do tempo,
//    com 16 dígitos de precisão;
//  - acima disso, camadas, como na break_eternity: na camada l o valor é 10
//    elevado a 10 elevado a ... (l vezes) a m, com 300 <= m < 1e300 (na camada 1,
//    m >= 9e15). A camada é um double, então o teto é 10↑↑(9e15): uma torre de
//    nove quatrilhões de dez.
// Os valores são imutáveis: toda conta devolve um novo.

const BIG_LIMIT = 1e300; // daqui para cima, mantissa e expoente
const BIG_LOG_LIMIT = 300; // log10(BIG_LIMIT)
const BIG_EXP_LIMIT = 9e15; // expoente máximo com inteiros exatos; daqui para cima, camadas

class Big {
  // l = camada, s = sinal (só usado nas camadas)
  constructor(m, e, l = 0, s = 1) {
    this.m = m;
    this.e = e;
    this.l = l;
    this.s = s;
  }

  // Aceita Big, número, texto ("150", "1.5e400", "ee1234") ou { m, e }.
  static from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'number') return Big.make(x, 0);
    if (typeof x === 'string') return Big.parse(x);
    if (x && typeof x.m === 'number') return Big.make(x.m, x.e || 0);
    return Big.ZERO;
  }

  // O formato do toJSON: cada "e" na frente é uma camada.
  static parse(text) {
    let str = text.trim();
    let s = 1;
    if (str[0] === '-') { s = -1; str = str.slice(1); }
    let l = 0;
    while (str[l] === 'e' || str[l] === 'E') l++;
    if (l > 0) {
      const mag = Number(str.slice(l));
      return Number.isNaN(mag) ? Big.ZERO : Big.norm(s, l, mag);
    }
    const n = Number(str);
    if (Number.isFinite(n)) return Big.make(s * n, 0);
    const i = str.search(/e/i);
    if (i < 0) return Big.ZERO;
    return Big.make(s * Number(str.slice(0, i)), Number(str.slice(i + 1)));
  }

  // m · 10^e, na forma certa: double comum se couber, mantissa e expoente se não
  static make(m, e) {
    if (!m || Number.isNaN(m) || Number.isNaN(e) || e === -Infinity) return Big.ZERO;
    if (!Number.isFinite(m)) m = Math.sign(m) * Number.MAX_VALUE; // estourou o double: fica no maior que ele tem
    const k = Math.floor(Math.log10(Math.abs(m)));
    if (e + k < BIG_LOG_LIMIT) return new Big(e === 0 ? m : m * 10 ** e, 0);
    if (e + k >= BIG_EXP_LIMIT) return Big.norm(Math.sign(m), 1, e + Math.log10(Math.abs(m)));
    m /= 10 ** k;
    e += k;
    // corrige o arredondamento do log10 nas bordas
    if (Math.abs(m) >= 10) { m /= 10; e += 1; } else if (Math.abs(m) < 1) { m *= 10; e -= 1; }
    return new Big(m, e);
  }

  // Valor na camada l, com magnitude mag, na forma certa: sobe de camada quando
  // a magnitude passa de 1e300 e desce quando ela cabe na camada de baixo.
  static norm(s, l, mag) {
    if (!s || Number.isNaN(mag)) return Big.ZERO;
    if (mag === Infinity) mag = Number.MAX_VALUE;
    while (mag >= BIG_LIMIT) { mag = Math.log10(mag); l++; }
    while (l > 1 && mag < BIG_LOG_LIMIT) { mag = 10 ** mag; l--; }
    if (l === 1 && mag < BIG_EXP_LIMIT) return Big.fromLog10(mag, s);
    return new Big(mag, 0, l, s);
  }

  // s · 10^L, com L sendo um número comum (pode passar de 308)
  static fromLog10(L, s = 1) {
    if (Number.isNaN(L) || L === -Infinity) return Big.ZERO;
    if (L >= BIG_EXP_LIMIT) return Big.norm(s, 1, L);
    const e = Math.floor(L);
    return Big.make(s * 10 ** (L - e), e);
  }

  // 10^x, com x sendo um Big
  static exp10(x, s = 1) {
    x = Big.from(x);
    if (x.small) return Big.fromLog10(x.m, s);
    if (x.sign < 0) return Big.ZERO; // 10 elevado a menos um número enorme
    if (x.l === 0) return Big.norm(s, 2, x.log10());
    return Big.norm(s, x.l + 1, x.m);
  }

  // base^x com base e x comuns: o preço que cresce a cada compra
  static pow(base, x) {
    const r = base ** x;
    return Number.isFinite(r) && r < BIG_LIMIT ? new Big(r, 0) : Big.fromLog10(x * Math.log10(base));
  }

  // 10↑↑h: uma torre de h dez (h pode ter fração)
  static tower(h) {
    if (h < 0) return Big.ZERO;
    const l = Math.floor(h);
    const top = 10 ** (h - l);
    return l === 0 ? Big.from(top) : Big.norm(1, l, top);
  }

  static max(a, b) { return a.gte(b) ? a : b; }
  static min(a, b) { return a.lte(b) ? a : b; }

  get small() { return this.l === 0 && this.e === 0; }
  get sign() { return this.l ? this.s : Math.sign(this.m); }
  get layer() { return this.l; }
  // a magnitude guardada na camada (só faz sentido com camada >= 1)
  get mag() { return this.l ? this.m : Math.abs(this.m); }
  isZero() { return this.l === 0 && this.m === 0; }

  neg() { return this.l ? new Big(this.m, 0, this.l, -this.s) : new Big(-this.m, this.e); }
  abs() { return this.sign < 0 ? this.neg() : this; }

  // [mantissa, expoente] normalizados, para as contas sem camada fora do double comum
  parts() {
    if (!this.small || this.m === 0) return [this.m, this.e];
    const k = Math.floor(Math.log10(Math.abs(this.m)));
    let m = this.m / 10 ** k;
    let e = k;
    if (Math.abs(m) >= 10) { m /= 10; e += 1; } else if (Math.abs(m) < 1) { m *= 10; e -= 1; }
    return [m, e];
  }

  add(b) {
    b = Big.from(b);
    if (this.small && b.small) {
      const r = this.m + b.m;
      if (Math.abs(r) < BIG_LIMIT) return new Big(r, 0);
    }
    if (this.isZero()) return b;
    if (b.isZero()) return this;
    if (this.l === 0 && b.l === 0) {
      const [am, ae] = this.parts();
      const [bm, be] = b.parts();
      // uma diferença de mais de 17 casas some na precisão do double
      if (ae >= be) return ae - be > 17 ? this : Big.make(am + bm / 10 ** (ae - be), ae);
      return be - ae > 17 ? b : Big.make(bm + am / 10 ** (be - ae), be);
    }
    // com camadas, o maior manda
    const big = this.cmpAbs(b) >= 0 ? this : b;
    const low = big === this ? b : this;
    if (big.l >= 2) return big.l === low.l && big.m === low.m && big.sign !== low.sign ? Big.ZERO : big;
    const d = low.log10() - big.log10();
    if (d < -17) return big;
    const x = big.sign === low.sign ? 1 + 10 ** d : 1 - 10 ** d;
    return x > 0 ? Big.fromLog10(big.log10() + Math.log10(x), big.sign) : Big.ZERO;
  }

  sub(b) { return this.add(Big.from(b).neg()); }

  mul(b) {
    b = Big.from(b);
    if (this.small && b.small) {
      const r = this.m * b.m;
      if (Math.abs(r) < BIG_LIMIT) return new Big(r, 0);
    }
    if (this.isZero() || b.isZero()) return Big.ZERO;
    if (this.l === 0 && b.l === 0) {
      const [am, ae] = this.parts();
      const [bm, be] = b.parts();
      return Big.make(am * bm, ae + be);
    }
    // com camadas, multiplicar é somar os logaritmos
    return Big.exp10(this.log10Big().add(b.log10Big()), this.sign * b.sign);
  }

  div(b) {
    b = Big.from(b);
    if (this.small && b.small) {
      const r = this.m / b.m;
      if (Number.isFinite(r) && Math.abs(r) < BIG_LIMIT) return new Big(r, 0);
    }
    if (this.isZero() || b.isZero()) return Big.ZERO;
    if (this.l === 0 && b.l === 0) {
      const [am, ae] = this.parts();
      const [bm, be] = b.parts();
      return Big.make(am / bm, ae - be);
    }
    return Big.exp10(this.log10Big().sub(b.log10Big()), this.sign * b.sign);
  }

  // this^x, com x sendo um número comum
  pow(x) {
    if (this.isZero()) return x === 0 ? Big.from(1) : Big.ZERO;
    if (this.small) return Big.pow(this.m, x);
    return Big.exp10(this.log10Big().mul(x));
  }

  // compara só o tamanho, sem o sinal
  cmpAbs(b) {
    if (this.l !== b.l) return this.l > b.l ? 1 : -1;
    if (this.l) return Math.sign(this.m - b.m);
    if (this.small && b.small) return Math.sign(Math.abs(this.m) - Math.abs(b.m));
    if (this.isZero() || b.isZero()) return this.isZero() ? (b.isZero() ? 0 : -1) : 1;
    const [am, ae] = this.parts();
    const [bm, be] = b.parts();
    if (ae !== be) return ae > be ? 1 : -1;
    return Math.sign(Math.abs(am) - Math.abs(bm));
  }

  cmp(b) {
    b = Big.from(b);
    if (this.small && b.small) return Math.sign(this.m - b.m);
    const sa = this.sign;
    const sb = b.sign;
    if (sa !== sb) return Math.sign(sa - sb);
    return sa * this.cmpAbs(b);
  }

  gt(b) { return this.cmp(b) > 0; }
  gte(b) { return this.cmp(b) >= 0; }
  lt(b) { return this.cmp(b) < 0; }
  lte(b) { return this.cmp(b) <= 0; }
  eq(b) { return this.cmp(b) === 0; }

  // log10 do tamanho como número comum (Infinity a partir da camada 2 alta)
  log10() {
    if (this.small) return Math.log10(Math.abs(this.m));
    if (this.l === 0) return this.e + Math.log10(Math.abs(this.m));
    return this.l === 1 ? this.m : this.l === 2 ? 10 ** this.m : Infinity;
  }

  // log10 do tamanho como Big: funciona em qualquer camada
  log10Big() {
    if (this.l <= 1) return Big.from(this.log10());
    return Big.norm(1, this.l - 1, this.m);
  }

  // Fora do double comum todo valor já é inteiro, então não há o que arredondar.
  floor() { return this.small ? new Big(Math.floor(this.m), 0) : this; }
  ceil() { return this.small ? new Big(Math.ceil(this.m), 0) : this; }

  toNumber() {
    if (this.small) return this.m;
    if (this.l) return this.s * Infinity;
    return this.e > 308 ? this.m * Infinity : this.m * 10 ** this.e;
  }

  // no save vira texto: "150", "1.5e400" ou, com camadas, "ee1234" (10^10^1234)
  toJSON() {
    if (this.small) return String(this.m);
    if (this.l === 0) return this.m + 'e' + this.e;
    return (this.s < 0 ? '-' : '') + 'e'.repeat(this.l) + this.m;
  }

  toString() { return this.toJSON(); }
}

Big.ZERO = new Big(0, 0);
