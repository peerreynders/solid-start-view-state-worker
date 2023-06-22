export type State = {
	multiplicand: string;
	multiplier: string;
	product: number;
	error: undefined | string;
};

export type ViewModel = State;

export type Update = Partial<ViewModel>;

function stateToViewModel(state: State) {
	return state as ViewModel;
}

export { stateToViewModel };
