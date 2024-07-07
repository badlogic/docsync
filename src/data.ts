export type ClassEnumInterfaceOrStruct = {
	file: string;
	line: number;
	name: string;
	doc: string;
	methods: MethodOrFunction[];
	fields: FieldOrEnumValue[];
	type: "class" | "enum" | "interface" | "struct";
};

export type MethodOrFunction = {
	name: string;
	parameters: string;
	doc: string;
	line: number;
};

export type FieldOrEnumValue = {
	name: string;
	type: string;
	doc: string;
	line: number;
	isEnumValue: boolean;
};
