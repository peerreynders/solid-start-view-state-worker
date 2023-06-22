import {
	batch,
	createContext,
	createSignal,
	useContext,
	type Accessor,
	type ParentProps,
} from 'solid-js';

import { isServer } from 'solid-js/web';
import { nanoid } from 'nanoid';
import { stateToViewModel, type State } from '~/lib/core';
import type { ViewBound } from '~/lib/messages';

const makeInitialize = (state: State) => ({
	kind: 'initialize',
	state,
});

const makeUpdate = (
	kind: 'multiplicand-update' | 'multiplier-update',
	value: string
) => ({
	kind,
	id: nanoid(),
	value,
});

type Link = {
	setMultiplicand: (value: string) => void;
	setMultiplier: (value: string) => void;
	setProduct: (product: number) => void;
	setError: (error: string | undefined) => void;
};

const worker = (() => {
	if (isServer) return;

	let handler: (event: MessageEvent<ViewBound>) => void | undefined;
	const worker = new Worker('/view-state-worker.js');

	const register = (link: Link, state: State) => {
		handler = (event: MessageEvent<ViewBound>) => {
			if (event.data.kind === 'view-patch') {
				const patch = event.data.patch;
				batch(() => {
					link.setError('error' in patch ? patch.error : undefined);
					if (typeof patch.product === 'number') link.setProduct(patch.product);
					if (typeof patch.multiplicand === 'string')
						link.setMultiplicand(patch.multiplicand);
					if (typeof patch.multiplier === 'string')
						link.setMultiplier(patch.multiplier);
				});
				return;
			}
		};

		worker.addEventListener('message', handler);
		worker.postMessage(makeInitialize(state));
	};

	return {
		register,
		setMultiplicand: (value: string) =>
			worker.postMessage(makeUpdate('multiplicand-update', value)),
		setMultiplier: (value: string) =>
			worker.postMessage(makeUpdate('multiplier-update', value)),
	};
})();

function makeViewStateHolder() {
	const [multiplicand, setMultiplicand] = createSignal('0');
	const [multiplier, setMultiplier] = createSignal('0');
	const [product, setProduct] = createSignal(0);
	const [error, setError] = createSignal<string>();

	const viewState: {
		multiplicand: Accessor<string>;
		multiplier: Accessor<string>;
		product: Accessor<number>;
		error: Accessor<string | undefined>;
		setMultiplicand: (value: string) => void;
		setMultiplier: (value: string) => void;
	} = {
		multiplicand,
		multiplier,
		product,
		error,
		setMultiplicand,
		setMultiplier,
	};

	return {
		link: {
			setMultiplicand,
			setMultiplier,
			setProduct,
			setError,
		},
		viewState,
	};
}

const holder = makeViewStateHolder();

const ViewStateContext = createContext(holder.viewState);

export type Props = ParentProps & {
	state: string;
};

function ViewStateProvider(props: Props) {
	const link = holder.link;
	const state = JSON.parse(props.state) as State;

	const model = stateToViewModel(state);
	link.setMultiplicand(model.multiplicand);
	link.setMultiplier(model.multiplier);
	link.setProduct(model.product);
	link.setError(model.error);

	if (worker) {
		// Splice in worker
		holder.viewState.setMultiplicand = worker.setMultiplicand;
		holder.viewState.setMultiplier = worker.setMultiplier;

		worker.register(link, state);
	}

	return (
		<ViewStateContext.Provider value={holder.viewState}>
			{props.children}
		</ViewStateContext.Provider>
	);
}

const useViewState = () => useContext(ViewStateContext);

export { ViewStateProvider, useViewState };
