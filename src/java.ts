import Parser, { SyntaxNode } from "tree-sitter";
import Java from "tree-sitter-java";
import { ClassEnumInterfaceOrStruct, FieldOrEnumValue, MethodOrFunction } from "./data";

const classNodeTypes = new Set<string>(["class_declaration", "enum_declaration", "interface_declaration"]);

function findClasses(file: string, node: SyntaxNode, classes: ClassEnumInterfaceOrStruct[]) {
	if (classNodeTypes.has(node.type)) {
		const name = node.childForFieldName("name")?.text;
		if (name) {
			const javadoc = node.previousSibling?.type == "block_comment" ? node.previousNamedSibling?.text ?? "" : "";
			classes.push({
				name,
				file,
				line: node.startPosition.row,
				doc: javadoc,
				methods: findMethods(node),
				fields: findFields(node),
				type: node.type == "class_declaration" ? "class" : node.type == "enum_declaration" ? "enum" : "interface"
			});
		}
	}

	for (const child of node.children) {
		findClasses(file, child, classes);
	}
}

function findFields(node: SyntaxNode) {
	const fields: FieldOrEnumValue[] = [];
	const enumBody = node.children.find((c) => c.type == "enum_body");
	if (enumBody) {
		const enumName = node.childForFieldName("name")?.text ?? "";
		const enumConsts = enumBody.children.filter((c) => c.type == "enum_constant");
		for (const enumConst of enumConsts) {
			const name = enumConst.childForFieldName("name")?.text;
			const javadoc = enumConst.previousSibling?.type == "block_comment" ? enumConst.previousNamedSibling?.text : undefined;
			if (name && javadoc) {
				fields.push({
					doc: javadoc,
					line: enumConst.startPosition.row,
					name,
					type: enumName,
					isEnumValue: true
				});
			}
		}
	}
	return fields;
}

function findMethods(node: Parser.SyntaxNode) {
	const methods: MethodOrFunction[] = [];
	let javadoc = "";

	const classBody = node.children.find((c) => c.type == "class_body" || c.type == "interface_body");
	if (classBody) {
		for (const child of classBody.children) {
			if (child.type == "method_declaration") {
				const methodName = child.childForFieldName("name")?.text || "";
				const parameters = child.childForFieldName("parameters")?.text || "()";
				methods.push({ name: methodName, parameters, doc: javadoc, line: child.startPosition.row });
				javadoc = "";
			} else if (child.type == "block_comment") {
				javadoc = child.text;
			}
		}
	}

	return methods;
}

export function parseJavaFile(file: string, content: string) {
	const parser = new Parser();
	parser.setLanguage(Java);
	const ast = parser.parse(content, undefined, { bufferSize: 1024 * 1024 });
	const classes: ClassEnumInterfaceOrStruct[] = [];
	for (const node of ast.rootNode.children) {
		findClasses(file, node, classes);
	}
	return classes;
}
