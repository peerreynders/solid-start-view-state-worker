/// <reference lib="webworker" />
// file: src/worker/entry-worker.ts

import type { State } from '../lib/core';
import type { ViewBound, WorkerBound, Initialize } from '../lib/messages';

function isWorker(value: unknown): asserts value is DedicatedWorkerGlobalScope {
	let record =
		value && typeof value === 'object'
			? (value as Record<string, unknown>)
			: undefined;

	if (!(record && typeof record['close'] === 'function'))
		throw new Error('Not a Worker');
}

function toNumberOrError(text: string) {
	if (text.length < 1) return undefined;

	const value = Number(text);
	return Number.isNaN(value) ? 'Please write two numbers' : value;
}

function toNumber(text: string) {
	const value = toNumberOrError(text);
	return typeof value === 'number' ? value : undefined;
}

function putState(href: string, state: State) {
	return fetch(href, {
		method: 'PUT',
		body: JSON.stringify(state),
	});
}

type Request = Exclude<WorkerBound, Initialize>;

class Handler {
	postMessage: (message: ViewBound) => void;
	apiHref: string;
	multiplicand: number | undefined;
	multiplier: number | undefined;
	state: State | undefined;

	constructor(postMessage: (message: ViewBound) => void, apiHref: string) {
		this.postMessage = postMessage;
		this.apiHref = apiHref;
	}

	handleEvent(event: Event) {
		if (event.type !== 'message') return;
		const message = (event as MessageEvent<WorkerBound>).data;

		if (this.state && message.kind !== 'initialize')
			this.handleRequest(this.state, message);
		else if (!this.state && message.kind === 'initialize') {
			this.state = message.state;
			// set intermediate values
			this.multiplicand = toNumber(this.state.multiplicand);
			this.multiplier = toNumber(this.state.multiplier);
		}
	}

	handleRequest(state: State, request: Request) {
		switch (request.kind) {
			case 'multiplicand-update':
				this.handleMultiplicand(state, request.id, request.value);
				return;

			case 'multiplier-update':
				this.handleMultiplier(state, request.id, request.value);
				return;
		}
	}

	handleMultiplicand(state: State, id: string, text: string) {
		this.multiplicand = undefined;
		state.multiplicand = text.trim();
		const result = toNumberOrError(state.multiplicand);

		if (typeof result === 'number') {
			this.multiplicand = result;
			this.postProduct(state, id, 'multiplicand-update');
			return;
		}

		if (result) {
			this.postError(state, id, result);
			return;
		}
	}

	handleMultiplier(state: State, id: string, text: string) {
		this.multiplier = undefined;
		state.multiplier = text.trim();
		const result = toNumberOrError(state.multiplier);

		if (typeof result === 'number') {
			this.multiplier = result;
			this.postProduct(state, id, 'multiplier-update');
			return;
		}

		if (result) {
			this.postError(state, id, result);
			return;
		}
	}

	postProduct(
		state: State,
		id: string,
		kind: 'multiplicand-update' | 'multiplier-update'
	) {
		if (!this.multiplicand || !this.multiplier) return;

		state.product = this.multiplicand * this.multiplier;
		state.error = undefined;

		const patch =
			kind === 'multiplicand-update'
				? {
						multiplicand: state.multiplicand,
						product: state.product,
				  }
				: {
						multiplier: state.multiplier,
						product: state.product,
				  };

		this.postMessage({
			kind: 'view-patch',
			id,
			patch,
		});

		putState(this.apiHref, state);
	}

	postError(state: State, id: string, error: string) {
		state.error = error;
		this.postMessage({
			kind: 'view-patch',
			id,
			patch: {
				error,
			},
		});
	}
}

const API_PATHNAME = '/api/state';

(async function start() {
	isWorker(self);

	const handler = new Handler(
		(message: ViewBound) => self.postMessage(message),
		self.location.origin + API_PATHNAME
	);

	// Try not to miss any requests
	self.addEventListener('message', handler);
})();
