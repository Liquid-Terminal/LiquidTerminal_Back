import { SingleFlight } from '../../../src/utils/singleFlight';

const deferred = <T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('SingleFlight', () => {
  it('runs one computation for concurrent callers of the same key', async () => {
    const flight = new SingleFlight();
    const gate = deferred<number>();
    const compute = jest.fn(() => gate.promise);

    const calls = Array.from({ length: 5 }, () => flight.run('k', compute));
    gate.resolve(42);

    await expect(Promise.all(calls)).resolves.toEqual([42, 42, 42, 42, 42]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('keeps keys independent', async () => {
    const flight = new SingleFlight();
    const compute = jest.fn(async (value: string) => value);
    await expect(Promise.all([flight.run('a', () => compute('a')), flight.run('b', () => compute('b'))]))
      .resolves.toEqual(['a', 'b']);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('forgets a key once it settles, success or failure', async () => {
    const flight = new SingleFlight();
    const failing = deferred<number>();
    const first = flight.run('k', () => failing.promise);
    const second = flight.run('k', async () => 1);
    failing.reject(new Error('boom'));
    await expect(first).rejects.toThrow('boom');
    await expect(second).rejects.toThrow('boom');

    await expect(flight.run('k', async () => 7)).resolves.toBe(7);
  });
});
