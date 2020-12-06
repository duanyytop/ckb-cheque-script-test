const CKB = require('@nervosnetwork/ckb-sdk-core').default
const { scriptToHash, rawTransactionToHash } = require('@nervosnetwork/ckb-sdk-utils')
const {
  secp256k1LockScript,
  secp256k1Dep,
  getCells,
  collectInputs,
  collectInputsWithoutFee,
  receiverLockInfo,
  senderLockInfo,
  chequeLockInfo,
} = require('./helper')
const { ChequeDep } = require('../utils/const')
const { CKB_NODE_RPC } = require('../utils/config')

const ckb = new CKB(CKB_NODE_RPC)
const FEE = BigInt(1000)
const CHEQUE_CELL_CAPACITY = BigInt(200) * BigInt(100000000)

const generateChequeOutputs = async (inputCapacity, isReceiverArgs) => {
  const { senderLockScript } = await senderLockInfo()
  const chequeLockScript = await chequeLockInfo(isReceiverArgs)
  let outputs = [
    {
      capacity: `0x${CHEQUE_CELL_CAPACITY.toString(16)}`,
      lock: chequeLockScript,
    },
  ]
  const changeCapacity = inputCapacity - FEE - CHEQUE_CELL_CAPACITY
  outputs.push({
    capacity: `0x${changeCapacity.toString(16)}`,
    lock: senderLockScript,
  })
  return outputs
}

const generateClaimOutputs = async (inputCapacity, chequeInputCapacity) => {
  const { senderLockScript } = await senderLockInfo()
  const { receiverLockScript } = await receiverLockInfo()
  let outputs = [
    {
      capacity: `0x${(inputCapacity - FEE).toString(16)}`,
      lock: receiverLockScript,
    },
    {
      capacity: `0x${chequeInputCapacity.toString(16)}`,
      lock: senderLockScript,
    },
  ]
  return outputs
}

const createChequeCell = async isReceiverArgs => {
  const { senderLockScript, senderPrivateKey } = await senderLockInfo()
  const liveCells = await getCells(senderLockScript)
  const { inputs, capacity } = collectInputs(liveCells, CHEQUE_CELL_CAPACITY, '0x0')
  const outputs = await generateChequeOutputs(capacity, isReceiverArgs)
  const cellDeps = [await secp256k1Dep()]
  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs,
    outputs,
    outputsData: ['0x', '0x'],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const signedTx = ckb.signTransaction(senderPrivateKey)(rawTx)
  const txHash = await ckb.rpc.sendTransaction(signedTx)
  console.info(`Creating cheque cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

const claimChequeWithSignature = async () => {
  const { receiverPrivateKey, receiverLockArgs, receiverLockScript } = await receiverLockInfo()
  const chequeLockScript = await chequeLockInfo(true)
  const liveCells = await getCells(await secp256k1LockScript(receiverLockArgs))
  const { inputs, capacity } = collectInputs(liveCells, CHEQUE_CELL_CAPACITY, '0x0')
  const chequeLiveCells = await getCells(chequeLockScript)
  const { inputs: chequeInputs, capacity: chequeCapacity } = collectInputsWithoutFee(chequeLiveCells, CHEQUE_CELL_CAPACITY, '0x0')
  const outputs = await generateClaimOutputs(capacity, chequeCapacity)
  const cellDeps = [await secp256k1Dep(), ChequeDep]
  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs: [...inputs, ...chequeInputs],
    outputs,
    outputsData: ['0x', '0x'],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 1 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const keys = new Map()
  keys.set(scriptToHash(receiverLockScript), receiverPrivateKey)
  keys.set(scriptToHash(chequeLockScript), receiverPrivateKey)
  const signedWitnesses = ckb.signWitnesses(keys)({
    transactionHash: rawTransactionToHash(rawTx),
    witnesses: rawTx.witnesses,
    inputCells: rawTx.inputs.map((input, index) => {
      return {
        outPoint: input.previousOutput,
        lock: index === 0 ? receiverLockScript : chequeLockScript,
      }
    }),
    skipMissingKeys: true,
  })
  const signedTx = { ...rawTx, witnesses: signedWitnesses }
  const txHash = await ckb.rpc.sendTransaction(signedTx)
  console.info(`Claiming cheque cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

const claimChequeWithInputs = async () => {
  const { receiverPrivateKey, receiverLockArgs, receiverLockScript } = await receiverLockInfo()
  const chequeLockScript = await chequeLockInfo(false)

  const liveCells = await getCells(await secp256k1LockScript(receiverLockArgs))
  const { inputs, capacity } = collectInputs(liveCells, CHEQUE_CELL_CAPACITY, '0x0')

  const chequeLiveCells = await getCells(chequeLockScript)
  const { inputs: chequeInputs, capacity: chequeCapacity } = collectInputsWithoutFee(chequeLiveCells, CHEQUE_CELL_CAPACITY, '0x0')

  const outputs = await generateClaimOutputs(capacity, chequeCapacity)
  const cellDeps = [await secp256k1Dep(), ChequeDep]
  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs: [...inputs, ...chequeInputs],
    outputs,
    outputsData: ['0x', '0x'],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const keys = new Map()
  keys.set(scriptToHash(receiverLockScript), receiverPrivateKey)
  keys.set(scriptToHash(chequeLockScript), null)
  const signedWitnesses = ckb.signWitnesses(keys)({
    transactionHash: rawTransactionToHash(rawTx),
    witnesses: rawTx.witnesses,
    inputCells: rawTx.inputs.map((input, index) => {
      return {
        outPoint: input.previousOutput,
        lock: index === 0 ? receiverLockScript : chequeLockScript,
      }
    }),
    skipMissingKeys: true,
  })
  const signedTx = { ...rawTx, witnesses: signedWitnesses }
  const txHash = await ckb.rpc.sendTransaction(signedTx)
  console.info(`Claiming cheque cell with same input tx has been sent with tx hash ${txHash}`)
  return txHash
}

module.exports = {
  createChequeCell,
  claimChequeWithSignature,
  claimChequeWithInputs,
}
