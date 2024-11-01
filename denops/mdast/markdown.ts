//@deno-types="npm:@types/mdast"
import type { Heading, Nodes, Root } from "npm:mdast";
import remarkGfm from "npm:remark-gfm";
import remarkParse from "npm:remark-parse";
//@deno-types="npm:unified"
import { unified } from "npm:unified";
//@deno-types="npm:@types/unist"
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
	/** 所属する見出しノード */
	get leaderHeading(): Heading | undefined;
	/** 所属する見出しノードのアドレス */
	get leaderHeadingAddress(): number[] | undefined;
	/** 次の見出しノード */
	get nextHeading(): Heading | undefined;
	/** 前の見出しノード */
	get previousHeading(): Heading | undefined;
	/** 現在の見出しに含まれる小さい見出しのリスト */
	get subHeadings(): Heading[];
	/** 現在の見出しに含まれる範囲 */
	get headingRange(): { start: Cursor; end: Cursor };
	/** ヘッダーのレベルを取得 */
	get headingLevel(): number;
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
	"leaderHeading",
	"leaderHeadingAddress",
	"nextHeading",
	"previousHeading",
	"subHeadings",
	"headingRange",
	"headingLevel",
	"nodeType",
] as const;

function testCursor(cursor: Cursor, position: Position): -1 | 0 | 1 {
	if (cursor.line < position.start.line) {
		return -1;
	}
	if (cursor.line >= position.start.line && cursor.line <= position.end.line) {
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
		// アドレスが空ならルート
		if (address.length === 0) return undefined;

		const lastAddressIndex = address[address.length - 1];
		const parentAddr = address.slice(0, -1);

		// もし自身が長男だったら
		if (lastAddressIndex === 0) {
			return parentAddr;
		}
		// 最後が0でない場合
		let addr = parentAddr.concat(lastAddressIndex - 1);
		let node = this.getNode(addr)!;

		for (;;) {
			if (!("children" in node) || node.children.length === 0) {
				return addr;
			}
			const lastChildIndex = node.children.length - 1;
			addr = addr.concat(lastChildIndex);
			node = this.getNode(addr)!;
		}
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
	get leaderHeading() {
		const addr = this.leaderHeadingAddress;
		if (!addr) return undefined;
		return this.getNode(addr) as Heading;
	}
	get leaderHeadingAddress() {
		let addr: number[] | undefined = this.includingNodeAddress;
		let node = this.getNode(addr)!;
		while (node.type !== "heading") {
			addr = this.decrementAddress(addr);
			if (!addr) return undefined;
			node = this.getNode(addr)!;
		}
		return addr;
	}
	get nextHeading() {
		let addr: number[] | undefined = this.incrementAddress(
			this.includingNodeAddress,
		)!;
		for (;;) {
			const node = this.getNode(addr)!;
			if (node.type === "heading") {
				return node;
			}
			addr = this.incrementAddress(addr);
			if (!addr) return undefined;
		}
	}
	get previousHeading() {
		let addr: number[] | undefined = this.decrementAddress(
			this.includingNodeAddress,
		)!;
		for (;;) {
			const node = this.getNode(addr)!;
			if (node.type === "heading") {
				return node;
			}
			addr = this.decrementAddress(addr);
			if (!addr) return undefined;
		}
	}
	get subHeadings() {
		const leader = this.leaderHeading;
		const headings: Heading[] = [];

		if (!leader) {
			// All headings
			let addr: number[] | undefined = [];
			for (;;) {
				const node = this.getNode(addr)!;
				if (node.type === "heading") {
					headings.push(node);
				}
				addr = this.incrementAddress(addr);
				if (!addr) return headings;
			}
		}

		const leaderDepth = leader.depth;
		let addr: number[] | undefined = this.incrementAddress(
			this.leaderHeadingAddress!, // leaderHeadingAddress is not undefined because leader exists
		)!;
		for (;;) {
			const node = this.getNode(addr)!;
			if (node.type === "heading") {
				if (node.depth > leaderDepth) {
					break;
				}
				headings.push(node);
			}
			addr = this.incrementAddress(addr);
			if (!addr) break;
		}
		return headings;
	}
	get headingRange() {
		const leader = this.leaderHeading;
		if (!leader) {
			return this._ast.position!;
		}
		let start = null;
		let addr: number[] | undefined = this.leaderHeadingAddress;
		for (;;) {
			addr = this.incrementAddress(addr!);
			if (!addr) {
				return {
					start: this._ast.position!.end,
					end: this._ast.position!.end,
				};
			}
			const node = this.getNode(addr)!;
			if (node.position) {
				start = node.position.start;
				break;
			}
		}
		let end = null;
		let lastPositionedAddr = null;
		for (;;) {
			addr = this.incrementAddress(addr!);
			if (!addr) {
				return { start, end: this._ast.position!.end };
			}
			const node = this.getNode(addr)!;
			if (node.type === "heading") {
				if (lastPositionedAddr) {
					end = this.getNode(lastPositionedAddr)!.position!.end;
				} else {
					end = start;
				}
				break;
			}
			if (node.position) {
				lastPositionedAddr = addr;
			}
		}
		return { start, end };
	}
	get headingLevel() {
		const heading = this.leaderHeading;
		if (!heading) return 0;
		return heading.depth;
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
