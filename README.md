# solid-start-view-state-worker

Ridiculously extended version of [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API#examples)'s [simple-web-worker](https://github.com/mdn/dom-examples/tree/main/web-workers/simple-web-worker). 

## Discussion

The point is the **message-based** main-to-worker interface.

```TypeScript
// file: src/lib/message.ts
import type { State, ViewModel } from './core';

export type Initialize = {
  kind: 'initialize';
  state: State;
};

export type OperandUpdate = {
  kind: 'multiplicand-update' | 'multiplier-update';
  id: string;
  value: string;
};

export type WorkerBound = Initialize | OperandUpdate;

export type ViewPatch = {
  kind: 'view-patch';
  id: string;
  patch: Partial<ViewModel>;
};

export type ViewBound = ViewPatch;
```

Rather than forcing some RPC abstraction on top of [`postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage) (and expanding it to an object wrapped around the [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker)) go with the flow (the messages are deliberately authored as the `WorkerBound` and `ViewBound` [discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)).

- When there is something the worker needs to know send it a `WorkerBound` message.
- When the worker has something for you it will send a `ViewBound` message.
- In the odd cases where a `ViewBound` message needs to be related back to a `WorkerBound` message, use a [correlation identifier](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CorrelationIdentifier.html) (`id` in `OperandUpdate` and `Viewpatch` demonstrates this).

In the spirit of [Command Query Separation](https://martinfowler.com/bliki/CommandQuerySeparation.html) the design directives for the interface/protocol are:

- Commands were possible (only requires a one-way message)
- Query only when absolutely necessary (more than one message related via correlation IDs)

This also mirrors the thinking behind [Tell, Don't Ask](https://martinfowler.com/bliki/TellDontAsk.html) (TDA).

[Read/Write Segregation](https://www.solidjs.com/guides/getting-started#3-readwrite-segregation) of signals also emphasizes TDA; a `Setter<T>` **tells** the signal the next change, while `Accessor<T>` **tells** the signal consumer the current signal value from now on, even as it changes. Consequently messages map well to signals:

```TypeScript
// file: src/components/view-state-context.tsx
// …

function makeViewStateHolder() {
  const [multiplicand, setMultiplicand] = createSignal('0');
  const [multiplier, setMultiplier] = createSignal('0');
  const [product, setProduct] = createSignal(0);
  const [error, setError] = createSignal<string | undefined>();

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
```

Above the signals `multiplicand()`, `multiplier()`, `product()`, and `error()` link into the "holes" in the DOM. They can "teleport" any value updates from `ViewBound` message to the DOM:

```TypeScript
// file: src/components/view-state-context.tsx
// …

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
```

`viewState.setMultiplicand()` and `viewState.setMultiplier()` on the other hand are used to dispatch `WorkerBound` messages:

```TypeScript
// file: src/components/view-state-context.tsx
// …

const worker = (() => {
  // …

  return {
    register,
    setMultiplicand: (value: string) =>
      worker.postMessage(makeUpdate('multiplicand-update', value)),
    setMultiplier: (value: string) =>
      worker.postMessage(makeUpdate('multiplier-update', value)),
  };
})();

// …

function ViewStateProvider(props: Props) {
  // …

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
```

That way event handlers can dispatch a message whenever an input changes:

```TypeScript
// file: src/routes/index.tsx
// …

export default function Home() {
  const view = useViewState();
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
      {/* … */}
      <form onInput={setOperand}>
        {/* … */}
        <input type="text" id="number1" value={view.multiplicand()} />
        {/* … */}
        <input type="text" id="number2" value={view.multiplier()} />
        {/* … */}
      </form>
      <p class="result">{viewResult(view)}</p>
      {/* … */}
    </>
  );
}

```

Later the result of that change will be "teleported" back into the DOM:

```TypeScript
// file: src/routes/index.tsx
// …

type ViewState = ReturnType<typeof useViewState>;

const viewResult = ({ error, product }: ViewState) => {
  const errorText = error();
  return errorText ? errorText : `Result: ${product()}`;
};

```

In this simple case each primitive value was represented by it's own signal. 

Does this scale to a regular size application? 

### Using Stores

The `View` can consist of one or more [stores](https://www.solidjs.com/docs/latest/api#using-stores) perhaps even mixed with some signals. 

Stores also support "nested setting" where a path and a new value is used to update the store, so the worker could simply send a list of patches instead of the entire store state. 

Consider the following:

```TypeScript
// file: src/lib/message.ts

// …

type PatchTuple<T, K extends keyof T> = [K, T[K]];

export type Patch =
  | PatchTuple<ViewModel, 'multiplicand'>
  | PatchTuple<ViewModel, 'multiplier'>
  | PatchTuple<ViewModel, 'product'>
  | PatchTuple<ViewModel, 'error'>;

export type ViewPatch = {
  kind: 'view-patch';
  id: string;
  patches: Patch[];
};
```
`Patch` is a union of all the supported updates to the store and `ViewPatch` (`ViewBound`) message now carries an array of `Patch`es instead of a `Partial<ViewModel>`

```TypeScript
// file: src/components/view-store-context.tsx

// …

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
```

The individual signals have now been replaced with `holder.view.model`.

```TypeScript
// file: src/components/view-store-context.tsx

// …

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
```

Now `holder.view.model` is updated by applying all `Patch` tuples delivered by a `ViewPatch` message (`model.error` is deleted when it isn't explicitly set).

```
// file: src/components/view-store-context.tsx

// …

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
```

In the page `view.model` is consumed as follows:

```TypeScript
// file: src/routes/index.tsx

// …

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
      {/* … */}
      <form onInput={setOperand}>
        {/* … */}
        <input type="text" id="number1" value={view.model.multiplicand} />
        {/* … */}
        <input type="text" id="number2" value={view.model.multiplier} />
        {/* … */}
      </form>
      <p class="result">{viewResult(view)}</p>
      {/* … */}
    </>
  );
}
```

## State Walktrough

The state starts in the server's `repo`; here just represented by a server side in-memory value.

``` TypeScript
// file: src/server/repo.ts

import type { State } from '~/lib/core';

const serverSideState: State = {
  multiplicand: '6',
  multiplier: '7',
  product: 42,
  error: undefined,
};

const selectState = () => serverSideState;

const updateState = (state: State) => Object.assign(serverSideState, state);

export { selectState, updateState };
```

Server side the state is accessed with `fromServer()`.

```TypeScript
// file: src/components/worker-state.tsx

// …

// --- START server side ---
import { selectState } from '~/server/repo';

const fromServer = () => JSON.stringify(selectState());

// --- END server side ---
```

During SSR `fromServer()` obtains the state from the server
and feeds it both into `ViewStoreProvider` and `WorkerState`.

```TypeScript
// file: src/root.tsx

// …

export default function Root() {
  const state = isServer ? fromServer() : fromAppJson(document);

  return (
    <Html lang="en">
      {/* … */}
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
```

`WorkerState` renders its prop as an [embedded data block](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#embedding_data_in_html);

```TypeScript
// file: src/components/worker-state.tsx

// …

function WorkerState(props: Props) {
  return (
    <Show when={isServer}>
      <script id={APP_JSON_ID} type="application/json">
        {props.state}
      </script>
    </Show>
  );
}
```

Client side the state is extracted from the server rendered DOM with `fromAppJson()` … 

```TypeScript
// file: src/components/worker-state.tsx

// …

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
```

… and then passed to `ViewStoreProvider` …

```TypeScript
// file: src/components/view-store-context.tsx

// …

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
```

… which then posts it to the `Worker` … 

```TypeScript
// file: src/components/view-store-context.tsx

// …

const register = (setModel: (...patch: Patch) => void, state: State) => {
  // …
  worker.addEventListener('message', handler);
  worker.postMessage(makeInitialize(state));
};
```

… to initialize itself.

```TypeScript
// file: src/worker/entry-worker.ts

// …

class Handler {
  // …
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
}
```

Whenever the `Worker` calculates a new `product` it `PUT`s the most recent state back to the server …

```TypeScript
// file: src/worker/entry-worker.ts

// …

function putState(href: string, state: State) {
	return fetch(href, {
		method: 'PUT',
		body: JSON.stringify(state),
	});
}
```

… via the `/api/state` [API route](https://start.solidjs.com/core-concepts/api-routes).

```
// file: src/state/api/state
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
```
