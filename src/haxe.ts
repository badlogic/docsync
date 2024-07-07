import Parser, { SyntaxNode } from "tree-sitter";
import Haxe from "tree-sitter-haxe";
import { ClassEnumInterfaceOrStruct, FieldOrEnumValue, MethodOrFunction } from "./data";

const classNodeTypes = new Set<string>(["class_declaration", "enum_declaration", "interface_declaration"]);

function findClasses(file: string, node: SyntaxNode, children: SyntaxNode[], classes: ClassEnumInterfaceOrStruct[]) {
	if (classNodeTypes.has(node.type)) {
		const name = node.childForFieldName("name")?.text;
		if (name) {
			const javadoc = node.previousSibling?.type == "block_comment" ? node.previousNamedSibling?.text ?? "" : "";
			classes.push({
				name,
				file,
				line: node.startPosition.row,
				doc: javadoc,
				methods: findMethods(children),
				fields: findFields(children),
				type: node.type == "class_declaration" ? "class" : node.type == "enum_declaration" ? "enum" : "interface"
			});
		}
	}
}

function findFields(children: SyntaxNode[]) {
	const fields: FieldOrEnumValue[] = [];
	const fieldDeclarations = children.filter((c) => c.type == "variable_declaration" || c.type == "property_identifier");
	for (const fieldDecl of fieldDeclarations) {
		const isEnumValue = fieldDecl.type == "property_identifier";
		const name = isEnumValue ? fieldDecl.text : fieldDecl.childForFieldName("name")?.text ?? "";
		const type = fieldDecl.childForFieldName("type")?.text ?? "";
		const javadoc = fieldDecl.previousSibling?.type == "comment" ? fieldDecl.previousNamedSibling?.text : undefined;
		if (name) {
			fields.push({
				line: fieldDecl.startPosition.row,
				doc: javadoc ?? "",
				name,
				type,
				isEnumValue
			});
		}
	}

	return fields;
}

function findMethods(children: SyntaxNode[]) {
	const parseParameters = (fnDecl: SyntaxNode) => {
		let params = "";
		const start = fnDecl.children.findIndex((c) => c.text == "(");
		let child: SyntaxNode | null = fnDecl.children[start];
		while (child && child.text != ")") {
			params += child.text;
			child = child.nextSibling;
		}
		params += ")";
		return params;
	};

	const methods: MethodOrFunction[] = [];
	let doc = "";

	for (const child of children) {
		if (child.type == "function_declaration") {
			const methodName = child.childForFieldName("name")?.text || "";
			const parameters = parseParameters(child);
			methods.push({
				name: methodName,
				parameters,
				doc: doc,
				line: child.startPosition.row
			});
			doc = "";
		} else if (child.type == "comment") {
			doc = child.text;
		}
	}

	return methods;
}

export function parseHaxeFile(file: string, content: string) {
	const parser = new Parser();
	parser.setLanguage(Haxe);
	const ast = parser.parse(content, undefined, { bufferSize: 1024 * 1024 });
	const classes: ClassEnumInterfaceOrStruct[] = [];
	const classNode = ast.rootNode.children.find((n) => classNodeTypes.has(n.type));
	if (classNode) {
		const missedNodes: SyntaxNode[] = [];
		let next: SyntaxNode | null = classNode.nextSibling;
		while (next) {
			missedNodes.push(next);
			next = next.nextSibling;
		}
		const block = classNode.children.find((c) => c.type == "block");
		if (block) missedNodes.unshift(...block.children);
		findClasses(file, classNode, missedNodes, classes);
	}
	return classes;
}
