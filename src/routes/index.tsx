// file: src/routes/index.tsx

import { useViewStore } from '~/components/view-store-context';

function hasOwn<O extends Record<PropertyKey, unknown>>(
	obj: O,
	key: PropertyKey
): key is keyof O {
	return key in obj;
}

type View = ReturnType<typeof useViewStore>;

const viewResult = ({ model }: View) => {
	const errorText = model.error;
	return errorText ? errorText : `Result: ${model.product}`;
};

export default function Home() {
	const view = useViewStore();
	const dispatch = {
		['number1']: view.setMultiplicand,
		['number2']: view.setMultiplier,
	};
	const setOperand = (event: InputEvent) => {
		if (!(event.target instanceof HTMLInputElement)) return;

		const id = event.target.id;
		if (hasOwn(dispatch, id)) dispatch[id](event.target.value);

		event.stopPropagation();
	};

	return (
		<>
			<h1>
				Web
				<br />
				Workers
				<br />
				basic
				<br />
				example
			</h1>

			<div class="controls" tabindex="0">
				<form onInput={setOperand}>
					<div>
						<label for="number1">Multiply number 1: </label>
						<input type="text" id="number1" value={view.model.multiplicand} />
					</div>
					<div>
						<label for="number2">Multiply number 2: </label>
						<input type="text" id="number2" value={view.model.multiplier} />
					</div>
				</form>

				<p class="result">{viewResult(view)}</p>
			</div>
		</>
	);
}
