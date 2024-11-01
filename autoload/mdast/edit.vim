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

function mdast#edit#disable_heading(lnum = v:null, col = v:null) abort
	let md = join(getline(1, '$'), "\n")
	let lnum = a:lnum ? a:lnum : line('.')
	let col = a:col ? a:col : a:lnum ? 0 : col('.')

	let res = denops#request('mdast', 'editorState', [md, lnum, col, ['includingNode', 'headingDepth']])
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
	endif
endfunction

function mdast#edit#enable_heading(lnum = v:null, col = v:null) abort
	let md = join(getline(1, '$'), "\n")
	let lnum = a:lnum ? a:lnum : line('.')
	let col = a:col ? a:col : a:lnum ? 0 : col('.')

	let res = denops#request('mdast', 'editorState', [md, lnum, col, ['includingNode', 'headingDepth']])
	let includingNode = res.includingNode

	if !(has_key(includingNode, 'type') && includingNode.type == 'heading')
		let depth = res.headingDepth
		let l = getline(lnum)
		call setline(lnum, repeat('#', depth == 0 ? 1 : depth) . ' ' . l)
	endif
endfunction

function mdast#edit#toggle_heading(lnum = v:null, col = v:null) abort
	let md = join(getline(1, '$'), "\n")
	let lnum = a:lnum ? a:lnum : line('.')
	let col = a:col ? a:col : a:lnum ? 0 : col('.')

	let res = denops#request('mdast', 'editorState', [md, lnum, col, ['includingNode', 'headingDepth']])
	let includingNode = res.includingNode

	if has_key(includingNode, 'type') && includingNode.type == 'heading'
		call mdast#edit#disable_heading(lnum, col)
	else
		call mdast#edit#enable_heading(lnum, col)
	endif
endfunction

function mdast#edit#increment_heading(lnum = v:null, col = v:null) abort
	let md = join(getline(1, '$'), "\n")
	let lnum = a:lnum ? a:lnum : line('.')
	let col = a:col ? a:col : a:lnum ? 0 : col('.')

	let res = denops#request('mdast', 'editorState', [md, lnum, col, ['leaderHeading']])
	let leaderHeading = res.leaderHeading

	if type(leaderHeading) != v:t_dict
		throw 'No heading found'
	endif
	let depth = leaderHeading.depth
	if depth == 0
		throw 'No heading found'
	elseif depth >= 6
		throw 'Heading depth is too high'
	else
		let lnum = leaderHeading.position.start.line
		let col = leaderHeading.position.start.column

		call mdast#edit#disable_heading(lnum, col)
		let l = getline(lnum)
		call setline(lnum, repeat('#', depth + 1) . ' ' . l)
	endif
endfunction

function mdast#edit#decrement_heading(lnum = v:null, col = v:null) abort
	let md = join(getline(1, '$'), "\n")
	let lnum = a:lnum ? a:lnum : line('.')
	let col = a:col ? a:col : a:lnum ? 0 : col('.')

	let res = denops#request('mdast', 'editorState', [md, lnum, col, ['leaderHeading']])
	let leaderHeading = res.leaderHeading

	if type(leaderHeading) != v:t_dict
		throw 'No heading found'
	endif
	let depth = leaderHeading.depth
	if depth <= 1
		throw 'Heading depth is too low'
	else
		let lnum = leaderHeading.position.start.line
		let col = leaderHeading.position.start.column

		call mdast#edit#disable_heading(lnum, col)
		let l = getline(lnum)
		call setline(lnum, repeat('#', depth - 1) . ' ' . l)
	endif
endfunction
