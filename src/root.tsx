// @refresh reload
// file: src/root.tsx
import { Suspense } from 'solid-js';
import { isServer } from 'solid-js/web';
import {
	Body,
	ErrorBoundary,
	FileRoutes,
	Head,
	Html,
	Link,
	Meta,
	Routes,
	Scripts,
	Title,
} from 'solid-start';

import { ViewStoreProvider } from './components/view-store-context';
import {
	fromAppJson,
	fromServer,
	WorkerState,
} from './components/worker-state';

export default function Root() {
	const state = isServer ? fromServer() : fromAppJson(document);

	return (
		<Html lang="en">
			<Head>
				<Title>Web Workers basic example</Title>
				<Meta charset="utf-8" />
				<Meta name="viewport" content="width=device-width, initial-scale=1" />
				<Link rel="stylesheet" href="style.css" />
			</Head>
			<Body>
				<Suspense>
					<ErrorBoundary>
						<ViewStoreProvider state={state}>
							<Routes>
								<FileRoutes />
							</Routes>
						</ViewStoreProvider>
					</ErrorBoundary>
				</Suspense>
				<Scripts />
				<WorkerState state={state} />
			</Body>
		</Html>
	);
}
