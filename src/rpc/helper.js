const fetch = require('node-fetch')
const CKB = require('@nervosnetwork/ckb-sdk-core').default
const { scriptToHash } = require('@nervosnetwork/ckb-sdk-utils')
const { CKB_NODE_RPC, CKB_NODE_INDEXER, SENDER_PRIVATE_KEY, RECEIVER_PRIVATE_KEY } = require('../utils/config')
const { remove0x } = require('../utils/hex')
const { ChequeLockScript } = require('../utils/const')

const ckb = new CKB(CKB_NODE_RPC)
const FEE = BigInt(1000)

const secp256k1LockScript = async args => {
  const secp256k1Dep = (await ckb.loadDeps()).secp256k1Dep
  return {
    codeHash: secp256k1Dep.codeHash,
    hashType: secp256k1Dep.hashType,
    args,
  }
}

const generateLockArgs = privateKey => {
  const pubKey = ckb.utils.privateKeyToPublicKey(privateKey)
  return '0x' + ckb.utils.blake160(pubKey, 'hex')
}

const secp256k1LockHash = async args => {
  const lock = await secp256k1LockScript(args)
  return scriptToHash(lock)
}

const secp256k1Dep = async () => {
  const secp256k1Dep = (await ckb.loadDeps()).secp256k1Dep
  return { outPoint: secp256k1Dep.outPoint, depType: 'depGroup' }
}

const senderLockInfo = async () => {
  const senderLockArgs = generateLockArgs(SENDER_PRIVATE_KEY)
  return {
    senderPrivateKey: SENDER_PRIVATE_KEY,
    senderLockArgs: senderLockArgs,
    senderLockHash: await secp256k1LockHash(senderLockArgs),
    senderLockScript: await secp256k1LockScript(senderLockArgs),
  }
}

const receiverLockInfo = async () => {
  const receiverLockArgs = generateLockArgs(RECEIVER_PRIVATE_KEY)
  return {
    receiverPrivateKey: RECEIVER_PRIVATE_KEY,
    receiverLockArgs: receiverLockArgs,
    receiverLockHash: await secp256k1LockHash(receiverLockArgs),
    receiverLockScript: await secp256k1LockScript(receiverLockArgs),
  }
}

const chequeLockInfo = async isReceiverArgs => {
  const { senderLockHash } = await senderLockInfo()
  const { receiverLockArgs, receiverLockHash } = await receiverLockInfo()

  const receiver = isReceiverArgs ? remove0x(receiverLockArgs) : receiverLockHash.substring(2, 42)
  const chequeLockArgs = `0x${receiver}${senderLockHash.substring(2, 42)}`
  const chequeLock = { ...ChequeLockScript, args: chequeLockArgs }
  return chequeLock
}

const getCells = async lock => {
  let payload = {
    id: 1,
    jsonrpc: '2.0',
    method: 'get_cells',
    params: [
      {
        script: {
          code_hash: lock.codeHash,
          hash_type: lock.hashType,
          args: lock.args,
        },
        script_type: 'lock',
      },
      'asc',
      '0x64',
    ],
  }
  const body = JSON.stringify(payload, null, '  ')
  try {
    let res = await fetch(CKB_NODE_INDEXER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    })
    res = await res.json()
    return res.result.objects
  } catch (error) {
    console.error('error', error)
  }
}

const collectInputs = (liveCells, needCapacity, since) => {
  let inputs = []
  let sum = BigInt(0)
  for (let cell of liveCells) {
    inputs.push({
      previousOutput: {
        txHash: cell.out_point.tx_hash,
        index: cell.out_point.index,
      },
      since,
    })
    sum = sum + BigInt(cell.output.capacity)
    if (sum >= needCapacity + FEE) {
      break
    }
  }
  if (sum < needCapacity + FEE) {
    throw Error('Capacity not enough')
  }
  return { inputs, capacity: sum }
}

const collectInputsWithoutFee = (liveCells, needCapacity, since) => {
  let inputs = []
  let sum = BigInt(0)
  for (let cell of liveCells) {
    inputs.push({
      previousOutput: {
        txHash: cell.out_point.tx_hash,
        index: cell.out_point.index,
      },
      since,
    })
    sum = sum + BigInt(cell.output.capacity)
    if (sum >= needCapacity) {
      break
    }
  }
  if (sum < needCapacity) {
    throw Error('Capacity not enough')
  }
  return { inputs, capacity: sum }
}

module.exports = {
  chequeLockInfo,
  secp256k1LockScript,
  secp256k1Dep,
  getCells,
  collectInputs,
  collectInputsWithoutFee,
  senderLockInfo,
  receiverLockInfo,
}
