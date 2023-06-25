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
