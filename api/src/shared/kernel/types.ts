declare const brand: unique symbol;

/** Nominal type over a primitive, so a HeroId can't be passed where a MissionId is expected. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

declare const txBrand: unique symbol;

/** Opaque handle to an open unit of work. Only infrastructure knows what is inside. */
export type Tx = { readonly [txBrand]: 'Tx' };

export interface TransactionManager {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

