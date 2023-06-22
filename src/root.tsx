// @refresh reload
import { Suspense } from 'solid-js';
import {
	// A,
	Body,
	ErrorBoundary,
	FileRoutes,
	Head,
	Html,
	Meta,
	Routes,
	Scripts,
	Title,
} from 'solid-start';

import { ViewStateProvider } from './components/view-state-context';

export default function Root() {
	const state = '{"multiplicand":"6","multiplier":"7","product":"42"}';
	return (
		<Html lang="en">
			<Head>
				<Title>Web Workers basic example</Title>
				<Meta charset="utf-8" />
				<Meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="stylesheet" href="style.css" />
			</Head>
			<Body>
				<Suspense>
					<ErrorBoundary>
						<ViewStateProvider state={state}>
							<Routes>
								<FileRoutes />
							</Routes>
						</ViewStateProvider>
					</ErrorBoundary>
				</Suspense>
				<Scripts />
			</Body>
		</Html>
	);
}
