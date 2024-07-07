import Parser, { SyntaxNode } from "tree-sitter";
import CPP from "tree-sitter-cpp";
import { ClassEnumInterfaceOrStruct, FieldOrEnumValue, MethodOrFunction } from "./data";

const classNodeTypes = new Set<string>(["class_specifier", "struct_specifier", "enum_specifier"]);

function findClasses(file: string, node: SyntaxNode, classes: ClassEnumInterfaceOrStruct[]) {
	if (classNodeTypes.has(node.type)) {
		const nameNode = node.childForFieldName("name");
		const bodyNode = node.childForFieldName("body");
		if (bodyNode) {
			const name = nameNode?.text;
			if (name) {
				const javadoc = node.previousSibling?.type === "comment" ? node.previousNamedSibling?.text ?? "" : "";
				classes.push({
					file,
					line: node.startPosition.row,
					name,
					doc: javadoc,
					methods: [],
					fields: findFields(bodyNode),
					type: node.type === "class_specifier" ? "class" : node.type === "struct_specifier" ? "struct" : "enum"
				});
			}
		}
	}

	for (const child of node.children) {
		findClasses(file, child, classes);
	}
}

function findFields(body: SyntaxNode) {
	const fields: FieldOrEnumValue[] = [];

	const fieldDeclarations = body.children.filter((c) => c.type == "enumerator");
	for (const fieldDecl of fieldDeclarations) {
		const isEnumValue = fieldDecl.type == "enumerator";
		const name = fieldDecl.childForFieldName("name")?.text ?? "";
		const type = isEnumValue ? "" : fieldDecl.childForFieldName("type")?.text ?? "";
		const javadoc = fieldDecl.previousSibling?.type === "comment" ? fieldDecl.previousNamedSibling?.text : undefined;
		if (name) {
			fields.push({
				line: fieldDecl.startPosition.row,
				doc: javadoc ?? "",
				name,
				type,
				isEnumValue: true
			});
		}
	}
	return fields;
}

function transformOpaqueType(content: string): string {
	return content.replace(/SPINE_OPAQUE_TYPE\((\w+)\)/g, (match, typeName) => {
		return `typedef struct ${typeName} {} ${typeName};`;
	});
}

export function parseCFile(file: string, content: string) {
	content = transformOpaqueType(content);
	content = content.replace(/SP_API /g, "");
	const parser = new Parser();
	parser.setLanguage(CPP);
	const ast = parser.parse(content, undefined, { bufferSize: 1024 * 1024 });
	const classes: ClassEnumInterfaceOrStruct[] = [];
	for (const node of ast.rootNode.children) {
		findClasses(file, node, classes);
	}
	const methods: MethodOrFunction[] = [];
	const findMethodsRecursive = (node: SyntaxNode) => {
		if (node.type == "function_declarator") {
			const methodName = node.childForFieldName("declarator")?.text || "";
			const parameters = node.childForFieldName("parameters")?.text || "()";
			const doc = node.parent?.previousSibling?.type == "comment" ? node.parent?.previousSibling?.text ?? "" : "";
			methods.push({ name: methodName, parameters, doc, line: node.startPosition.row });
		}

		for (const child of node.children) {
			findMethodsRecursive(child);
		}
	};
	findMethodsRecursive(ast.rootNode);
	classes.sort((a, b) => b.name.length - a.name.length);
	for (const method of methods) {
		const cl = classes.find((c) => method.name.startsWith(c.name));
		cl?.methods.push(method);
	}
	return classes;
}
