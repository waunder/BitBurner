import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pageCommand,selectPage} from './get_target_stats.js'

test('page commands are recognized without treating arbitrary text as a command',()=>{
  for(const command of ['next','prev','previous','first','last','1','12'])assert.equal(pageCommand(command),true)
  for(const command of ['', '0', '-1', 'next page'])assert.equal(pageCommand(command),false)
})

test('page navigation clamps at the ends and numbers are one-based',()=>{
  assert.equal(selectPage('next',0,3),1)
  assert.equal(selectPage('next',2,3),2)
  assert.equal(selectPage('prev',0,3),0)
  assert.equal(selectPage('previous',2,3),1)
  assert.equal(selectPage('first',2,3),0)
  assert.equal(selectPage('last',0,3),2)
  assert.equal(selectPage('2',0,3),1)
  assert.equal(selectPage('99',0,3),2)
})
