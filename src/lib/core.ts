// file: src/lib/core.ts

export type State = {
	multiplicand: string;
	multiplier: string;
	product: number;
	error: undefined | string;
};

export type ViewModel = State;

function stateToViewModel(state: State) {
	return state as ViewModel;
}

export { stateToViewModel };
