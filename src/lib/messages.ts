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
