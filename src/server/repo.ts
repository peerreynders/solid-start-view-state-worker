// file: src/server/repo.ts

import type { State } from '~/lib/core';

const serverSideState: State = {
	multiplicand: '6',
	multiplier: '7',
	product: 42,
	error: undefined,
};

const selectState = () => serverSideState;

const updateState = (state: State) => Object.assign(serverSideState, state);

export { selectState, updateState };
