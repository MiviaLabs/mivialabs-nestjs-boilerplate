import { Tx } from './tx';

export type TxCallback<ResType> = (tx: Tx, res?: ResType) => Promise<ResType>;
