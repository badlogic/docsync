import * as fs from "fs";
import { parseJavaFile } from "./java";
import { parseTypeScriptFile } from "./typescript";
import { parseHaxeFile } from "./haxe";
import { parseCppFile } from "./cpp";
import { parseCppLiteFile } from "./cpp-lite";
import { parseCFile } from "./c";

export function parseFile(filePath: string) {
	const content = fs.readFileSync(filePath, "utf-8");
	if (filePath.endsWith(".java")) return parseJavaFile(filePath, content);
	if (filePath.endsWith(".ts")) return parseTypeScriptFile(filePath, content);
	if (filePath.endsWith(".hx")) return parseHaxeFile(filePath, content);
	if (filePath.endsWith("spine-cpp-lite.h")) return parseCppLiteFile(filePath, content);
	if (filePath.endsWith(".h") && filePath.includes("spine-cpp")) return parseCppFile(filePath, content);
	if (filePath.endsWith(".h")) return parseCFile(filePath, content);
	else throw new Error("Unsupported language");
}

const filePath = process.argv[2];
if (!filePath) {
	console.error("Please provide a file path as the first argument.");
	process.exit(1);
}

const classes = parseFile(filePath);
console.log(JSON.stringify(classes, null, 2));
