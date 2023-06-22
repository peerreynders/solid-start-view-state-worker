import { useViewState } from '~/components/view-state-context';

type ViewState = ReturnType<typeof useViewState>;

const viewResult = ({ error, product }: ViewState) => {
	const errorText = error();
	return errorText ? errorText : `Result: ${product()}`;
};

export default function Home() {
	const view = useViewState();

	const setMultiplicand = (
		event: InputEvent & { currentTarget: HTMLElement }
	) => {
		if (!(event.currentTarget instanceof HTMLInputElement)) return;

		view.setMultiplicand(event.currentTarget.value);
		event.stopPropagation();
	};

	const setMultiplier = (
		event: InputEvent & { currentTarget: HTMLElement }
	) => {
		if (!(event.currentTarget instanceof HTMLInputElement)) return;

		view.setMultiplier(event.currentTarget.value);
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
				<form>
					<div>
						<label for="number1">Multiply number 1: </label>
						<input
							type="text"
							id="number1"
							value={view.multiplicand()}
							onInput={setMultiplicand}
						/>
					</div>
					<div>
						<label for="number2">Multiply number 2: </label>
						<input
							type="text"
							id="number2"
							value={view.multiplier()}
							onInput={setMultiplier}
						/>
					</div>
				</form>

				<p class="result">{viewResult(view)}</p>
			</div>
		</>
	);
}
