import * as bip39 from "bip39";
import BIP32Factory from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { ECPairFactory } from "ecpair";

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const NETWORKS = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
} as const;

export type NetworkName = keyof typeof NETWORKS;

export interface DerivedAddress {
  index: number;
  path: string;
  address: string;
  publicKey: string;
  change: 0 | 1;
}

export interface CreateWalletInput {
  bip: 44 | 49 | 84 | 86;
  network?: NetworkName;
  strength?: 128 | 160 | 192 | 224 | 256;
  passphrase?: string;
  mnemonic?: string;
  count?: number;
}

export interface CreateWalletOutput {
  bip: number;
  scheme: string;
  network: NetworkName;
  mnemonic: string;
  seedHex: string;
  derivationPath: string;
  xpub: string;
  fingerprint: string;
  receive: DerivedAddress[];
  change: DerivedAddress[];
}

function purposeForBip(bip: number): number {
  return bip;
}

function coinForNetwork(net: NetworkName): number {
  return net === "mainnet" ? 0 : 1;
}

function rootPath(bip: number, net: NetworkName): string {
  const purpose = purposeForBip(bip);
  return `m/${purpose}'/${coinForNetwork(net)}'/0'`;
}

function p2trAddress(pubkey: Buffer, network: bitcoin.Network): string {
  const internalPubkey = pubkey.subarray(1, 33);
  const { address } = bitcoin.payments.p2tr({ internalPubkey, network });
  if (!address) throw new Error("p2tr address derivation failed");
  return address;
}

function deriveAddressForBip(
  node: ReturnType<typeof bip32.fromSeed>,
  bip: number,
  network: bitcoin.Network,
  change: 0 | 1,
  index: number,
): DerivedAddress {
  const child = node.derive(change).derive(index);
  const path = `${change}/${index}`;
  const pubkey = Buffer.from(child.publicKey);
  let address: string | undefined;
  if (bip === 44) {
    address = bitcoin.payments.p2pkh({ pubkey, network }).address;
  } else if (bip === 49) {
    const redeem = bitcoin.payments.p2wpkh({ pubkey, network });
    address = bitcoin.payments.p2sh({ redeem, network }).address;
  } else if (bip === 84) {
    address = bitcoin.payments.p2wpkh({ pubkey, network }).address;
  } else if (bip === 86) {
    address = p2trAddress(pubkey, network);
  }
  if (!address) throw new Error("address derivation failed");
  return { index, path, address, publicKey: pubkey.toString("hex"), change };
}

export function createWallet(input: CreateWalletInput): CreateWalletOutput {
  const network = input.network ?? "mainnet";
  const net = NETWORKS[network];
  const strength = input.strength ?? 128;
  const mnemonic = input.mnemonic
    ? input.mnemonic.trim()
    : bip39.generateMnemonic(strength);
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic");
  }
  const seed = bip39.mnemonicToSeedSync(mnemonic, input.passphrase ?? "");
  const root = bip32.fromSeed(seed, net);
  const accountPath = rootPath(input.bip, network);
  const account = root.derivePath(accountPath);
  const fingerprint = Buffer.from(root.fingerprint).toString("hex");
  const xpub = account.neutered().toBase58();
  const count = Math.max(1, Math.min(20, input.count ?? 5));
  const receive: DerivedAddress[] = [];
  const change: DerivedAddress[] = [];
  for (let i = 0; i < count; i++) {
    receive.push(deriveAddressForBip(account, input.bip, net, 0, i));
    change.push(deriveAddressForBip(account, input.bip, net, 1, i));
  }
  return {
    bip: input.bip,
    scheme: bipScheme(input.bip),
    network,
    mnemonic,
    seedHex: seed.toString("hex"),
    derivationPath: accountPath,
    xpub,
    fingerprint,
    receive,
    change,
  };
}

function bipScheme(bip: number): string {
  if (bip === 44) return "Legacy P2PKH";
  if (bip === 49) return "Nested SegWit P2SH-P2WPKH";
  if (bip === 84) return "Native SegWit P2WPKH";
  if (bip === 86) return "Taproot P2TR";
  return "unknown";
}

export interface MultisigInput {
  m: number;
  cosigners?: number;
  network?: NetworkName;
  type?: "p2sh" | "p2wsh" | "p2sh-p2wsh";
  publicKeysHex?: string[];
  mnemonics?: string[];
  passphrases?: string[];
}

export interface MultisigSigner {
  index: number;
  mnemonic: string;
  publicKey: string;
  xpub: string;
  derivationPath: string;
}

export interface MultisigOutput {
  m: number;
  n: number;
  type: string;
  network: NetworkName;
  address: string;
  redeemScript: string;
  witnessScript?: string;
  signers: MultisigSigner[];
}

export function createMultisig(input: MultisigInput): MultisigOutput {
  const network = input.network ?? "mainnet";
  const net = NETWORKS[network];
  const type = input.type ?? "p2wsh";
  const m = Math.max(1, Math.min(15, input.m));
  const n = Math.max(m, Math.min(15, input.cosigners ?? Math.max(m, 3)));

  const accountPath = `m/48'/${coinForNetwork(network)}'/0'/2'`;
  const signers: MultisigSigner[] = [];
  const pubkeys: Buffer[] = [];

  if (input.publicKeysHex && input.publicKeysHex.length === n) {
    input.publicKeysHex.forEach((hex, i) => {
      const pk = Buffer.from(hex, "hex");
      pubkeys.push(pk);
      signers.push({
        index: i,
        mnemonic: "(provided pubkey only)",
        publicKey: hex,
        xpub: "",
        derivationPath: "",
      });
    });
  } else {
    for (let i = 0; i < n; i++) {
      const mnemonic = input.mnemonics?.[i] ?? bip39.generateMnemonic(128);
      const passphrase = input.passphrases?.[i] ?? "";
      const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
      const root = bip32.fromSeed(seed, net);
      const account = root.derivePath(accountPath);
      const child = account.derive(0).derive(0);
      const pk = Buffer.from(child.publicKey);
      pubkeys.push(pk);
      signers.push({
        index: i,
        mnemonic,
        publicKey: pk.toString("hex"),
        xpub: account.neutered().toBase58(),
        derivationPath: `${accountPath}/0/0`,
      });
    }
  }

  pubkeys.sort((a, b) => a.compare(b));

  const ms = bitcoin.payments.p2ms({ m, pubkeys, network: net });
  let address: string | undefined;
  let redeemScript: Buffer | undefined;
  let witnessScript: Buffer | undefined;
  const toBuf = (v: Uint8Array | undefined): Buffer | undefined =>
    v ? Buffer.from(v) : undefined;
  if (type === "p2sh") {
    const p = bitcoin.payments.p2sh({ redeem: ms, network: net });
    address = p.address;
    redeemScript = toBuf(ms.output);
  } else if (type === "p2wsh") {
    const p = bitcoin.payments.p2wsh({ redeem: ms, network: net });
    address = p.address;
    witnessScript = toBuf(ms.output);
    redeemScript = toBuf(ms.output);
  } else {
    const wsh = bitcoin.payments.p2wsh({ redeem: ms, network: net });
    const p = bitcoin.payments.p2sh({ redeem: wsh, network: net });
    address = p.address;
    redeemScript = toBuf(wsh.output);
    witnessScript = toBuf(ms.output);
  }
  if (!address) throw new Error("multisig address derivation failed");
  return {
    m,
    n,
    type,
    network,
    address,
    redeemScript: redeemScript?.toString("hex") ?? "",
    witnessScript: witnessScript?.toString("hex"),
    signers,
  };
}

export interface SendInput {
  network?: NetworkName;
  bip: 44 | 49 | 84 | 86;
  mnemonic: string;
  passphrase?: string;
  scanCount?: number;
  toAddress: string;
  amountSats: number;
  feeRate: number;
  changeIndex?: number;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number };
  address: string;
  derivationPath: string;
  scriptPubKey: string;
  rawTxHex?: string;
}

async function fetchAddressUtxos(
  address: string,
  network: NetworkName,
): Promise<Array<{ txid: string; vout: number; value: number; status: { confirmed: boolean; block_height?: number } }>> {
  const base = network === "mainnet" ? "https://mempool.space/api" : "https://mempool.space/testnet/api";
  const r = await fetch(`${base}/address/${address}/utxo`);
  if (!r.ok) throw new Error(`utxo fetch failed: ${r.status}`);
  return (await r.json()) as Array<{ txid: string; vout: number; value: number; status: { confirmed: boolean; block_height?: number } }>;
}

async function fetchRawTxHex(txid: string, network: NetworkName): Promise<string> {
  const base = network === "mainnet" ? "https://mempool.space/api" : "https://mempool.space/testnet/api";
  const r = await fetch(`${base}/tx/${txid}/hex`);
  if (!r.ok) throw new Error(`raw tx fetch failed: ${r.status}`);
  return await r.text();
}

async function broadcastTx(hex: string, network: NetworkName): Promise<string> {
  const base = network === "mainnet" ? "https://mempool.space/api" : "https://mempool.space/testnet/api";
  const r = await fetch(`${base}/tx`, { method: "POST", body: hex });
  const text = await r.text();
  if (!r.ok) throw new Error(`broadcast failed: ${r.status} ${text}`);
  return text.trim();
}

export interface SendResult {
  txid: string;
  hex: string;
  fee: number;
  vsize: number;
  inputsUsed: number;
  changeSats: number;
}

function paymentForBip(
  bip: number,
  pubkey: Buffer,
  network: bitcoin.Network,
) {
  if (bip === 44) return bitcoin.payments.p2pkh({ pubkey, network });
  if (bip === 49) {
    const redeem = bitcoin.payments.p2wpkh({ pubkey, network });
    return bitcoin.payments.p2sh({ redeem, network });
  }
  if (bip === 84) return bitcoin.payments.p2wpkh({ pubkey, network });
  if (bip === 86) {
    return bitcoin.payments.p2tr({ internalPubkey: pubkey.subarray(1, 33), network });
  }
  throw new Error("unsupported bip");
}

export async function sendTransaction(input: SendInput): Promise<SendResult> {
  const network = input.network ?? "mainnet";
  const net = NETWORKS[network];
  if (!bip39.validateMnemonic(input.mnemonic)) throw new Error("invalid mnemonic");
  const seed = bip39.mnemonicToSeedSync(input.mnemonic, input.passphrase ?? "");
  const root = bip32.fromSeed(seed, net);
  const account = root.derivePath(rootPath(input.bip, network));
  const scanCount = Math.max(1, Math.min(40, input.scanCount ?? 10));

  type Owned = {
    address: string;
    pubkey: Buffer;
    privateKey: Buffer;
    change: 0 | 1;
    index: number;
  };
  const owned: Owned[] = [];
  for (const change of [0, 1] as const) {
    for (let i = 0; i < scanCount; i++) {
      const child = account.derive(change).derive(i);
      const pubkey = Buffer.from(child.publicKey);
      const pay = paymentForBip(input.bip, pubkey, net);
      if (!pay.address || !child.privateKey) continue;
      owned.push({
        address: pay.address,
        pubkey,
        privateKey: Buffer.from(child.privateKey),
        change,
        index: i,
      });
    }
  }

  if (input.bip === 86) {
    throw new Error(
      "Taproot (BIP86) sending not supported in this build — use BIP44, BIP49, or BIP84 wallet for sending.",
    );
  }
  const utxos: UTXO[] = [];
  for (const o of owned) {
    const us = await fetchAddressUtxos(o.address, network);
    for (const u of us) {
      const out = paymentForBip(input.bip, o.pubkey, net).output;
      if (!out) continue;
      const utxo: UTXO = {
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        status: u.status,
        address: o.address,
        derivationPath: `${o.change}/${o.index}`,
        scriptPubKey: Buffer.from(out).toString("hex"),
      };
      utxos.push(utxo);
    }
  }
  utxos.sort((a, b) => b.value - a.value);

  const psbt = new bitcoin.Psbt({ network: net });
  let inSum = 0;
  const target = input.amountSats;
  if (target <= 546) throw new Error("amount must be > 546 sats (dust)");
  let estVsize = 50;
  const inputBytes = input.bip === 44 ? 148 : input.bip === 49 ? 91 : 68;
  const outputBytes = 34;
  estVsize += outputBytes * 2;
  const used: UTXO[] = [];
  for (const u of utxos) {
    used.push(u);
    inSum += u.value;
    estVsize += inputBytes;
    const fee = Math.ceil(estVsize * input.feeRate);
    if (inSum >= target + fee + 546) break;
  }
  const fee = Math.ceil(estVsize * input.feeRate);
  if (inSum < target + fee) {
    throw new Error(`insufficient funds: have ${inSum} sats, need ${target + fee}`);
  }
  const changeAmount = inSum - target - fee;

  for (const u of used) {
    const owner = owned.find((o) => o.address === u.address)!;
    if (input.bip === 44) {
      const rawHex = await fetchRawTxHex(u.txid, network);
      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        nonWitnessUtxo: Buffer.from(rawHex, "hex"),
      });
    } else if (input.bip === 49) {
      const redeem = bitcoin.payments.p2wpkh({ pubkey: owner.pubkey, network: net });
      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        witnessUtxo: { script: Buffer.from(u.scriptPubKey, "hex"), value: BigInt(u.value) },
        redeemScript: Buffer.from(redeem.output!),
      });
    } else {
      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        witnessUtxo: { script: Buffer.from(u.scriptPubKey, "hex"), value: BigInt(u.value) },
      });
    }
  }

  psbt.addOutput({ address: input.toAddress, value: BigInt(target) });
  if (changeAmount > 546) {
    const ci = input.changeIndex ?? 0;
    const changeChild = account.derive(1).derive(ci);
    const changePay = paymentForBip(
      input.bip,
      Buffer.from(changeChild.publicKey),
      net,
    );
    psbt.addOutput({ address: changePay.address!, value: BigInt(changeAmount) });
  }

  for (let i = 0; i < used.length; i++) {
    const u = used[i]!;
    const owner = owned.find((o) => o.address === u.address)!;
    const kp = ECPair.fromPrivateKey(owner.privateKey, { network: net });
    psbt.signInput(i, {
      publicKey: Buffer.from(kp.publicKey),
      sign: (hash: Buffer) => Buffer.from(kp.sign(hash)),
    });
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  const hex = tx.toHex();
  const txid = await broadcastTx(hex, network);
  return {
    txid,
    hex,
    fee,
    vsize: tx.virtualSize(),
    inputsUsed: used.length,
    changeSats: changeAmount > 546 ? changeAmount : 0,
  };
}

export interface BalanceResult {
  totalSats: number;
  confirmedSats: number;
  unconfirmedSats: number;
  utxoCount: number;
  addresses: Array<{
    address: string;
    derivationPath: string;
    sats: number;
    txCount: number;
  }>;
}

interface AddressStats {
  funded_txo_sum: number;
  spent_txo_sum: number;
  tx_count: number;
}
interface MempoolAddrInfo {
  chain_stats: AddressStats;
  mempool_stats: AddressStats;
}

export async function getAddressInfo(address: string, network: NetworkName = "mainnet") {
  const base = network === "mainnet" ? "https://mempool.space/api" : "https://mempool.space/testnet/api";
  const r = await fetch(`${base}/address/${address}`);
  if (!r.ok) throw new Error(`address fetch failed: ${r.status}`);
  const j = (await r.json()) as MempoolAddrInfo;
  const txR = await fetch(`${base}/address/${address}/txs`);
  const txs = txR.ok ? ((await txR.json()) as Array<{ txid: string; status: { confirmed: boolean; block_time?: number; block_height?: number }; fee: number; vin: unknown[]; vout: unknown[] }>) : [];
  const confirmed = j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum;
  const unconfirmed = j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum;
  return {
    address,
    network,
    confirmedSats: confirmed,
    unconfirmedSats: unconfirmed,
    totalSats: confirmed + unconfirmed,
    txCount: j.chain_stats.tx_count + j.mempool_stats.tx_count,
    recentTxs: txs.slice(0, 10).map((t) => ({
      txid: t.txid,
      confirmed: t.status.confirmed,
      blockHeight: t.status.block_height ?? null,
      blockTime: t.status.block_time ?? null,
      feeSats: t.fee,
      inputs: t.vin.length,
      outputs: t.vout.length,
    })),
  };
}

export async function getWalletBalanceFromMnemonic(
  mnemonic: string,
  bip: 44 | 49 | 84 | 86,
  network: NetworkName = "mainnet",
  scanCount = 10,
  passphrase = "",
): Promise<BalanceResult> {
  if (!bip39.validateMnemonic(mnemonic)) throw new Error("invalid mnemonic");
  const net = NETWORKS[network];
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
  const root = bip32.fromSeed(seed, net);
  const account = root.derivePath(rootPath(bip, network));

  const result: BalanceResult = {
    totalSats: 0,
    confirmedSats: 0,
    unconfirmedSats: 0,
    utxoCount: 0,
    addresses: [],
  };
  for (const change of [0, 1] as const) {
    for (let i = 0; i < scanCount; i++) {
      const child = account.derive(change).derive(i);
      const pubkey = Buffer.from(child.publicKey);
      const pay = paymentForBip(bip, pubkey, net);
      if (!pay.address) continue;
      try {
        const info = await getAddressInfo(pay.address, network);
        if (info.totalSats > 0 || info.txCount > 0) {
          result.addresses.push({
            address: pay.address,
            derivationPath: `${change}/${i}`,
            sats: info.totalSats,
            txCount: info.txCount,
          });
          result.totalSats += info.totalSats;
          result.confirmedSats += info.confirmedSats;
          result.unconfirmedSats += info.unconfirmedSats;
        }
      } catch {}
    }
  }
  return result;
}
