const CKB = require('@nervosnetwork/ckb-sdk-core').default
const {
  secp256k1LockScript,
  secp256k1Dep,
  getCells,
  collectInputs,
  senderLockInfo,
  chequeLockInfo,
  collectInputsWithoutFee,
} = require('./helper')
const { ChequeDep } = require('../utils/const')
const { CKB_NODE_RPC } = require('../utils/config')

const ckb = new CKB(CKB_NODE_RPC)
const FEE = BigInt(1000)
const CHEQUE_CELL_CAPACITY = BigInt(200) * BigInt(100000000)
const CHEQUE_SINCE = '0xa000000000000006'

const generateChequeOutputs = async inputCapacity => {
  const { senderLockScript } = await senderLockInfo()
  const chequeLockScript = await chequeLockInfo(true)
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

const generateWithdrawOutputs = async (inputCapacity, chequeInputCapacity) => {
  const { senderLockScript } = await senderLockInfo()
  let outputs = [
    {
      capacity: `0x${(inputCapacity + chequeInputCapacity - FEE).toString(16)}`,
      lock: senderLockScript,
    },
  ]
  return outputs
}

const createWithdrawChequeCell = async () => {
  const { senderLockArgs, senderPrivateKey } = await senderLockInfo()
  const liveCells = await getCells(await secp256k1LockScript(senderLockArgs))
  const { inputs, capacity } = collectInputs(liveCells, CHEQUE_CELL_CAPACITY, '0x0')
  const outputs = await generateChequeOutputs(capacity)
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

const withdrawChequeCell = async () => {
  const { senderLockArgs, senderPrivateKey } = await senderLockInfo()
  const chequeLockScript = await chequeLockInfo(true)

  const liveCells = await getCells(await secp256k1LockScript(senderLockArgs))
  const { inputs, capacity } = collectInputs(liveCells, CHEQUE_CELL_CAPACITY, CHEQUE_SINCE)

  const chequeLiveCells = await getCells(chequeLockScript)
  const { inputs: chequeInputs, capacity: chequeCapacity } = collectInputsWithoutFee(chequeLiveCells, CHEQUE_CELL_CAPACITY, '0x0')

  const outputs = await generateWithdrawOutputs(capacity, chequeCapacity)
  const cellDeps = [await secp256k1Dep(), ChequeDep]
  const rawTx = {
    version: '0x0',
    cellDeps,
    headerDeps: [],
    inputs: [...inputs, ...chequeInputs],
    outputs,
    outputsData: ['0x'],
  }
  rawTx.witnesses = rawTx.inputs.map((_, i) => (i > 0 ? '0x' : { lock: '', inputType: '', outputType: '' }))
  const signedTx = ckb.signTransaction(senderPrivateKey)(rawTx)
  const txHash = await ckb.rpc.sendTransaction(signedTx)
  console.info(`Withdraw cheque cell tx has been sent with tx hash ${txHash}`)
  return txHash
}

module.exports = {
  createWithdrawChequeCell,
  withdrawChequeCell,
}
