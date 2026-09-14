import { TransactionStatusStream, type StatusChange } from './transaction-status-stream';

describe('TransactionStatusStream', () => {
  it('delivers only the changes of the observed transaction', () => {
    const stream = new TransactionStatusStream();
    const received: StatusChange[] = [];
    const subscription = stream.observe('tx-1').subscribe((change) => received.push(change));

    stream.publish({ transactionExternalId: 'tx-2', status: 'approved' });
    stream.publish({ transactionExternalId: 'tx-1', status: 'rejected' });
    subscription.unsubscribe();
    stream.publish({ transactionExternalId: 'tx-1', status: 'approved' });

    expect(received).toEqual([{ transactionExternalId: 'tx-1', status: 'rejected' }]);
  });
});
