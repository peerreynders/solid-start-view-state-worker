// file: src/api/state
import { ServerError } from 'solid-start';
import { APIEvent } from 'solid-start/api';
import { updateState } from '~/server/repo';
import type { State } from '~/lib/core';

function isState(state: unknown): state is State {
	return (
		!!state &&
		typeof state === 'object' &&
		'multiplicand' in state &&
		typeof state.multiplicand === 'string' &&
		'multiplier' in state &&
		typeof state.multiplier === 'string' &&
		'product' in state &&
		typeof state.product === 'number' &&
		(('error' in state &&
			typeof state.error === 'string' &&
			Object.keys(state).length === 4) ||
			(!('error' in state) && Object.keys(state).length === 3))
	);
}

async function fromBody(stream: ReadableStream<Uint8Array> | null) {
	let payload = '';
	if (!stream) return undefined;

	const utf8Decoder = new TextDecoder();
	for (const reader = stream.getReader(); ; ) {
		const { done, value } = await reader.read();
		if (done) break;

		payload += utf8Decoder.decode(value);
	}

	if (payload.length < 1) return undefined;

	const data = JSON.parse(payload);
	return isState(data) ? data : undefined;
}

async function PUT(event: APIEvent) {
	const state = await fromBody(event.request.body);
	if (!state) throw new ServerError('Illegal State Type');
	updateState(state);

	return new Response(null, { status: 204, statusText: 'No Content' });
}

export { PUT };
