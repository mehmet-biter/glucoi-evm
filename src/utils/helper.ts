import { Decimal } from "@prisma/client/runtime";
import * as safeMath from '@dip1059/safe-math-js';
import BigNumber from "bignumber.js";
import Web3 from "web3";
import _sodium from "libsodium-wrappers";
import { WITHDRAWAL_FIXED_FEES } from "../utils/coreConstant";
const crypto = require('crypto');

export function setApp() {

}



export const powerOfTen = (x:number) => {
    return Math.pow(10,x);
}

export const customFromWei = (amount:any,decimal:any) => {
  return convertCoinAmountFromInt(amount,decimal);
    let data:any = (amount/powerOfTen(decimal));
    const tokenAmountLocalAmount = data.toLocaleString().replaceAll(",","");
    return tokenAmountLocalAmount;
}

export const customToWei = (amount:number,decimal:number) =>
{
  return convertCoinAmountToInt(amount,decimal);
  const isDecimal = !Number.isInteger(amount);
  if (isDecimal) {
    const tokenDecimals :any = new BigNumber(10).pow(decimal);
    // const tokenToSend = new BigNumber(amount).times(tokenDecimals);

    const tokenAmount:any = amount * tokenDecimals;
    const tokenAmountLocalAmount = (tokenAmount.toLocaleString()).replaceAll(",","");
    const tokenAmountLength = tokenAmountLocalAmount.length;
    const tokenToSend = (tokenAmount).toPrecision(tokenAmountLength);

    return tokenToSend.toString();
  } else {
    const amountData = Web3.utils
      .toBN(amount)
      .mul(Web3.utils.toBN(10).pow(Web3.utils.toBN(decimal)));
    
    return amountData.toString();
  }
}

export const convertCoinAmountToInt = (
  amount: Decimal | number,
  decimal: number,
): string  => {
  let multiplier: any = '1';
  for (let i = 0; i < decimal; i++) {
    multiplier += '0';
  }
  const result = multiplyNumbers(Number(amount), Number(multiplier));
  return result['noExponents']().split('.')[0];
}

export const  convertCoinAmountFromInt = (
  amount: string | number,
  decimal: number,
): string => {
  let multiplier: any = '1';
  for (let i = 0; i < decimal; i++) {
    multiplier += '0';
  }
  const result = divideNumbers(Number(amount), Number(multiplier));
  return result['noExponents']();
}


  export const addNumbers = (...numbers: number[]): number  => {
    return safeMath.add(numbers);
  }
  
  export const minusNumbers =(...numbers: number[]): number => {
    return safeMath.minus(numbers);
  }
  
  export const multiplyNumbers = (...numbers: number[]): number => {
    return safeMath.multiply(numbers);
  }
  
  export const divideNumbers = (...numbers: number[]): number => {
    return safeMath.divide(numbers);
  }
  
  export const formatAmountDecimal = (amount: number, decimal: number): number  =>{
    return Number(amount.toFixed(decimal));
  }

  export const sleep = async (delay_in_milisec: number) => {
    await new Promise((resolve) => setTimeout(resolve, delay_in_milisec));
    return;
  }

  export enum REGEX {
    BTC_TXID = '^[a-fA-F0-9]{64}$',
    ETH_TXHASH = '^0x[a-fA-F0-9]{64}$',
  }

  /////////// Custom encryption section start here ///////////////////
  // Encrypt
  export const custome_encrypt = async (text:string):Promise<string> => {
    await _sodium.ready;
    let sodium = _sodium;
    let key = sodium.from_hex('681abfbdff0559329882f2a7960ec6d1b301851b58b4f9e33e57642abc46579e');    
    let nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    let chiperText = sodium.crypto_secretbox_easy(text, nonce, key);
    let encryptData = sodium.to_base64(concatBuffers(nonce, chiperText), sodium.base64_variants.URLSAFE_NO_PADDING);
    return encryptData;
  }

  // Decrypt
  export const custome_decrypt = async (text:string):Promise<string> => {
    await _sodium.ready; 
    let sodium = _sodium;
    let key = sodium.from_hex('681abfbdff0559329882f2a7960ec6d1b301851b58b4f9e33e57642abc46579e');    
    let data = sodium.from_base64(text, sodium.base64_variants.URLSAFE_NO_PADDING);
    let nonce = data.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    let ciphertext = data.slice(sodium.crypto_secretbox_NONCEBYTES);
    let decryptData = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    return sodium.to_string(decryptData);
  }

  function concatTypedArrays(a:any, b:any) {
    var c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }
  function concatBuffers(a:any, b:any) {
    return concatTypedArrays(
        new Uint8Array(a.buffer || a), 
        new Uint8Array(b.buffer || b)
    );
  }
  //////////// Custom encryption section end here //////////////////

  export const fees_calculator = (amount:number, fees:number, type:number):Decimal => {
    return type == WITHDRAWAL_FIXED_FEES ? new Decimal(fees) : new Decimal(((fees * amount) / 100).toFixed(8));
  }

  export const generateRandomString = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomString += characters.charAt(randomIndex);
    }
  
    return randomString;
  }

  export function createUniqueCode() {
    let date = new Date().getTime();
    const id = crypto.randomBytes(12).toString('hex');
    const data = id + date;
    return data;
  }

  export function rawDecimal(value: number): number {
    let decimal = 1;value++;
    for(let i=1; i<value; i++) {
        decimal *=10;
    }
    return decimal;
  }

  Number.prototype['noExponents'] = function () {
    const data = String(this).split(/[eE]/);
    if (data.length == 1) return data[0];
  
    let z = '';
    const sign = this < 0 ? '-' : '';
    const str = data[0].replace('.', '');
    let mag = Number(data[1]) + 1;
  
    if (mag < 0) {
      z = sign + '0.';
      while (mag++) z += '0';
      return z + str.replace(/^\-/, '');
    }
    mag -= str.length;
    while (mag--) z += '0';
    return str + z;
  };