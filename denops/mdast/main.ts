import jq from "npm:jq-web-wasm/jq.wasm";
import remarkGfm from "npm:remark-gfm";
import remarkParse from "npm:remark-parse";
import { unified } from "npm:unified";
import { assert, isArrayOf, isNumber, isString } from "jsr:@core/unknownutil";
import type { Denops } from "jsr:@denops/std";
import { createMarkdownEditorState, EditorStateFields } from "./markdown.ts";
import type { MarkdownEditorState } from "./markdown.ts";

export function main(denops: Denops) {
	denops.dispatcher = {
		editorState(markdown, lnum, cnum, fields) {
			assert(markdown, isString);
			assert(lnum, isNumber);
			assert(cnum, isNumber);
			assert(fields, isArrayOf(isString));
			const state = createMarkdownEditorState(markdown, {
				line: lnum,
				column: cnum,
			}) as unknown as {
				[key: string]: MarkdownEditorState[keyof MarkdownEditorState];
			};
			const set = new Set([...fields]);
			if (set.size !== fields.length) {
				throw new Error("fields must be unique");
			}
			const all = new Set([...fields, ...EditorStateFields]);
			if (all.size !== EditorStateFields.length) {
				throw new Error("fields must be a subset of MetadataFields");
			}

			return Object.assign(
				{},
				...fields.map((field) => ({
					[field]: state[field],
				})),
			);
		},
		mdastQuery(markdown, jquery) {
			assert(markdown, isString);
			assert(jquery, isString);
			const ast = unified().use(remarkGfm).use(remarkParse).parse(
				markdown,
			);
			return jq.json(ast, jquery);
		},
	};
}
