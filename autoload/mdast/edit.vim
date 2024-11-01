" start から end まで (end含む) の範囲を削除
function s:delete_range(start, end) abort
	let start = a:start
	let end = a:end
	if end.line - start.line > 1
		exec printf("%d,%d delete '_", start.line + 1, end.line - 1)
		let end.line = start.line + 1
	endif
	if end.line - start.line == 1
		let startLine = getline(start.line)
		let endLine = getline(end.line)
		call setline(start.line, startLine . endLine)
		exec printf("%d delete '_", end.line)
		let end = #{ line: start.line, column: strlen(startLine) + end.column }
	endif
	" 現時点で start.line == end.line
	let l = getline(start.line)
	let l = strcharpart(l, 0, start.column - 1) . strcharpart(l, end.column)

	call setline(start.line, l)
endfunction

function mdast#edit#toggle_heading(lnum = v:null, col = v:null) abort
	let md = join(getline(1, '$'), "\n")
	let lnum = a:lnum ? a:lnum : line('.')
	let col = a:col ? a:col : a:lnum ? 0 : col('.')

	let res = denops#request('mdast', 'editorState', [md, lnum, col, ['includingNode', 'headingLevel']])
	let includingNode = res.includingNode
	if has_key(includingNode, 'type') && includingNode.type == 'heading'
		" 削除範囲 [start, end] を取得
		let start = includingNode.position.start
		let end = includingNode.position.end
		for child in includingNode.children
			if has_key(child, 'position')
				let end = child.position.start
				if end.column > 0
					let end = #{ line: end.line, column: end.column - 1 }
				else
					let end = #{ line: end.line - 1, column: '$' }
				endif
				break
			endif
		endfor

		call s:delete_range(start, end)
	else
		let level = res.headingLevel
		let l = getline('.')
		call setline(lnum, repeat('#', level == 0 ? 1 : level) . ' ' . l)
	endif
endfunction
