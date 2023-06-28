// file: src/components/worker-state.tsx

import { Show } from 'solid-js';
import { isServer } from 'solid-js/web';

// --- START server side ---
import { selectState } from '~/server/repo';

const fromServer = () => JSON.stringify(selectState());

// --- END server side ---

const APP_JSON_ID = 'worker-state';

interface Root {
	getElementById(elementId: string): HTMLElement | null;
}

function fromAppJson(root: Root) {
	const json = root.getElementById(APP_JSON_ID)?.textContent?.trim();
	return !json || json.length < 1
		? '{"multiplicand":"0","multiplier":"0","product":0,"error":"Unable to reconstitute view state"}'
		: json;
}

export type Props = {
	state: string;
};

function WorkerState(props: Props) {
	return (
		<Show when={isServer}>
			<script id={APP_JSON_ID} type="application/json">
				{props.state}
			</script>
		</Show>
	);
}

export { fromServer, fromAppJson, WorkerState };
