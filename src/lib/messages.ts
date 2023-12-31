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

export type ViewBound = ViewPatch;
