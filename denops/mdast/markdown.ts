import type { Nodes, Root } from "npm:mdast";
import remarkGfm from "npm:remark-gfm";
import remarkParse from "npm:remark-parse";
import { unified } from "npm:unified";
import type { Position } from "npm:unist";

/** カーソルの位置 */
export interface Cursor {
	/** 行 */
	line: number;
	/** 列 */
	column: number;
}

/** Markdownの閲覧情報 */
export interface MarkdownEditorState {
	/** 現在のカーソル位置 */
	get cursor(): Cursor;
	set cursor(cursor: Cursor);
	/** MarkdownのAST */
	get ast(): Root;
	/** カーソルを含むノードのアドレス */
	get includingNodeAddress(): number[];
	/** カーソル直前・直後のノードのアドレス */
	get neighboringNodeAddress(): {
		previous: number[] | undefined;
		next: number[] | undefined;
	};
	/** 現在のカーソル位置のノード */
	get includingNode(): Nodes;
	/** ヘッダーのレベルを取得 */
	get headerLevel(): number;
	/** ノードのタイプを取得 */
	get nodeType(): string;
	/** アドレスをインクリメント */
	incrementAddress(address: number[]): number[] | undefined;
	/** アドレスをデクリメント */
	decrementAddress(address: number[]): number[] | undefined;
	/** アドレスからノードを取得 */
	getNode(address: number[]): Nodes | undefined;
}

export const EditorStateFields = [
	"cursor",
	"ast",
	"includingNodeAddress",
	"neighboringNodeAddress",
	"includingNode",
	"headerLevel",
	"nodeType",
] as const;

function testCursor(cursor: Cursor, position: Position): -1 | 0 | 1 {
	if (cursor.line < position.start.line) {
		return -1;
	}
	if (
		cursor.line >= position.start.line && cursor.line <= position.end.line
	) {
		if (
			cursor.line === position.start.line &&
			cursor.column < position.start.column
		) {
			return -1;
		}
		if (
			cursor.line === position.end.line &&
			cursor.column > position.end.column
		) {
			return 1;
		}
		return 0;
	}
	// if (cursor.line > position.end.line) {
	return 1;
	// }
}

class _EditorState implements MarkdownEditorState {
	constructor(
		markdown: string,
		public cursor: Cursor,
	) {
		this.cursor = cursor;
		this._ast = unified().use(remarkGfm).use(remarkParse).parse(markdown);
	}
	private _ast: Root;
	get ast() {
		return this._ast;
	}
	incrementAddress(address: number[]): number[] | undefined {
		let node = this.getNode(address)!;
		if ("children" in node) {
			return [...address, 0];
		}
		const addr = address.slice(0, -1);
		node = this.getNode(addr)!;
		while (
			"children" in node &&
			node.children.length - 1 === address[addr.length]
		) {
			if (node.type === "root") {
				// root node has no parent
				return undefined;
			}
			addr.pop();
			node = this.getNode(addr)!;
		}
		return [...addr, address[addr.length] + 1];
	}
	decrementAddress(address: number[]): number[] | undefined {
		let addr = [...address];
		while (addr[addr.length - 1] === 0) {
			if (this.getNode(addr)?.type === "root") {
				// root node has no parent
				return undefined;
			}
			addr = addr.slice(0, -1);
		}
		addr[addr.length - 1] -= 1;
		let node = this.getNode(addr)!;
		while ("children" in node) {
			addr.push(node.children.length - 1);
			node = node.children[node.children.length - 1];
		}
		return addr;
	}
	get includingNodeAddress() {
		let lastInsideAddr: number[] = [];
		let addr: number[] = this.incrementAddress(lastInsideAddr)!;
		for (;;) {
			const node = this.getNode(addr)!;
			if (node.position) {
				const test = testCursor(this.cursor, node.position);
				if (test === -1) {
					return lastInsideAddr;
				}
				if (test === 0) {
					lastInsideAddr = addr;
				}
			}
			addr = this.incrementAddress(addr)!;
		}
	}
	get neighboringNodeAddress() {
		let previous: number[] | undefined = undefined;
		let addr: number[] | undefined = [];
		while (addr) {
			const node = this.getNode(addr)!;
			if (node.position) {
				const test = testCursor(this.cursor, node.position);
				if (test === -1) {
					return { previous, next: addr };
				}
				if (test === 1) {
					previous = addr;
				}
			}
			addr = this.incrementAddress(addr);
		}
		return { previous, next: undefined };
	}
	get includingNode() {
		return this.getNode(this.includingNodeAddress)!;
	}
	get headerLevel() {
		let addr: number[] | undefined = this.includingNodeAddress;
		let node = this.getNode(addr)!;
		while (node.type !== "heading") {
			addr = this.decrementAddress(addr);
			if (!addr) return 0;

			node = this.getNode(addr)!;
		}
		return node.depth;
	}
	get nodeType() {
		return this.includingNode.type;
	}
	getNode(address: number[]): Nodes | undefined {
		let currentNode: Nodes = this._ast;
		for (const index of address) {
			if (!("children" in currentNode)) {
				return undefined;
			}
			currentNode = currentNode.children[index];
		}
		return currentNode;
	}
}

/** MarkdownMetadataを作成 */
export function createMarkdownEditorState(
	markdown: string,
	cursor: Cursor,
): MarkdownEditorState {
	return new _EditorState(markdown, cursor);
}
