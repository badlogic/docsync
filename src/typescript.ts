import Parser, { SyntaxNode } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { ClassEnumInterfaceOrStruct, FieldOrEnumValue, MethodOrFunction } from "./data";

const classNodeTypes = new Set<string>(["class_declaration", "interface_declaration", "enum_declaration"]);

function findClasses(file: string, node: SyntaxNode, classes: ClassEnumInterfaceOrStruct[]) {
	if (classNodeTypes.has(node.type)) {
		const name = node.childForFieldName("name")?.text;
		if (name) {
			const javadoc = node.previousSibling?.type == "comment" ? node.previousNamedSibling?.text ?? "" : "";
			classes.push({
				file,
				line: node.startPosition.row,
				name,
				doc: javadoc,
				methods: findMethods(node),
				fields: findFields(node),
				type: node.type == "class_declaration" ? "class" : node.type == "interface_declaration" ? "interface" : "enum"
			});
		}
	}

	for (const child of node.children) {
		findClasses(file, child, classes);
	}
}

function findFields(node: SyntaxNode) {
	const fields: FieldOrEnumValue[] = [];
	const classBody = node.children.find((c) => c.type == "class_body" || c.type == "interface_body" || c.type == "enum_body");
	if (classBody) {
		const fieldDeclarations = classBody.children.filter((c) => c.type == "public_field_definition" || c.type == "property_identifier");
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
	}
	return fields;
}

function findMethods(node: SyntaxNode) {
	const methods: MethodOrFunction[] = [];
	let javadoc = "";

	const classBody = node.children.find((c) => c.type == "class_body" || c.type == "interface_body" || c.type == "enum_body");
	if (classBody) {
		for (const child of classBody.children) {
			if (child.type == "method_definition" || child.type == "method_signature") {
				const methodName = child.childForFieldName("name")?.text || "";
				const parameters = child.childForFieldName("parameters")?.text || "()";
				methods.push({ name: methodName, parameters, doc: javadoc, line: child.startPosition.row });
				javadoc = "";
			} else if (child.type == "comment") {
				javadoc = child.text;
			}
		}
	}

	return methods;
}

export function parseTypeScriptFile(file: string, content: string) {
	const parser = new Parser();
	parser.setLanguage(TypeScript.typescript);
	const ast = parser.parse(content, undefined, { bufferSize: 1024 * 1024 });
	const classes: ClassEnumInterfaceOrStruct[] = [];
	for (const node of ast.rootNode.children) {
		findClasses(file, node, classes);
	}
	return classes;
}
