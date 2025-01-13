import axios from 'axios';
import {parse} from 'parse5'
import {findAllScripts, findContentWithinLibrary} from "../tools/utils";

describe('check result after run', () => {
  it('should html in response', async () => {

    const response = await axios.get<string>('http://localhost:4200/').then(res => res.data)
    const document = parse(response)
    const result = findContentWithinLibrary(document, 'p', 'ngh')
    expect(result).not.toBe(null);
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(1)
    expect(result[0]).toBe('TestSharedLibrary works!')

    const result1 = findAllScripts(document)
    expect(result1).not.toBe(null);
    expect(Array.isArray(result1)).toBe(true)
    let hasModuleBefore = false

    for(const item of result1) {
      if(item.attrs.type === 'module') {
        hasModuleBefore = true
      }
      if(item.attrs.name === 'importmap') break
    }
    expect(hasModuleBefore).toBe(false)
  })
})
