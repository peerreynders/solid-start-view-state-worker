// file: src/components/view-store-context.tsx

import {
	batch,
	createContext,
	useContext,
	type Context,
	type ParentProps,
} from 'solid-js';
import { createStore, type Store } from 'solid-js/store';
import { isServer } from 'solid-js/web';

import { nanoid } from 'nanoid';
import { stateToViewModel, type State, type ViewModel } from '~/lib/core';

import type { Patch, ViewBound } from '~/lib/messages';

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

const worker = (() => {
	if (isServer) return;

	let handler: (event: MessageEvent<ViewBound>) => void | undefined;
	const worker = new Worker('/view-state-worker.js');

	const register = (setModel: (...patch: Patch) => void, state: State) => {
		handler = (event: MessageEvent<ViewBound>) => {
			if (event.data.kind === 'view-patch') {
				const patches: Patch[] = event.data.patches;
				batch(() => {
					let clearError = true;
					for (const patch of patches) {
						setModel(...patch);
						if (patch[0] === 'error') clearError = false;
					}
					if (clearError) setModel('error', undefined);
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

type Holder = {
	setModel: (...patch: Patch) => void;
	view: {
		model: Store<ViewModel>;
		setMultiplicand: (value: string) => void;
		setMultiplier: (value: string) => void;
	};
};

function makeContext(state: State) {
	// Extract the values necessary for the view
	const [model, setModel] = createStore(stateToViewModel(state));
	const holder: Holder = {
		setModel,
		view: {
			model,
			setMultiplicand: worker
				? worker.setMultiplicand
				: (value: string) => setModel('multiplicand', value),
			setMultiplier: worker
				? worker.setMultiplier
				: (value: string) => setModel('multiplier', value),
		},
	};

	const tuple: [Holder, Context<Holder['view']>] = [
		holder,
		createContext(holder.view),
	];
	return tuple;
}

let holder: Holder | undefined;
let ViewStoreContext: Context<Holder['view']> | undefined;

export type Props = ParentProps & {
	state: string;
};

function ViewStoreProvider(props: Props) {
	const state = JSON.parse(props.state) as State;
	[holder, ViewStoreContext] = makeContext(state);

	if (worker) worker.register(holder.setModel, state);

	return (
		<ViewStoreContext.Provider value={holder.view}>
			{props.children}
		</ViewStoreContext.Provider>
	);
}

const useViewStore = () => {
	if (!ViewStoreContext) throw new Error('ViewContext not yet initialized');

	return useContext(ViewStoreContext);
};

export { ViewStoreProvider, useViewStore };
