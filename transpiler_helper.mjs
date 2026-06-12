import { transpileToStandaloneFactory } from '@opus-aether-ai/pine-transpiler';

/**
 * Transpiles Pine Script code into a standalone JavaScript PineJS Indicator Factory.
 * @param {string} pineCode - The plaintext Pine Script source code.
 * @returns {Object} An object containing success, jsCode (if successful), or error message (if failed).
 */
export function transpilePineToJS(pineCode) {
  try {
    if (!pineCode || typeof pineCode !== 'string') {
      return { success: false, error: 'Pine Script source code must be a non-empty string.' };
    }
    
    // Check if the script contains strategy directives, which are not supported by the JS transpiler
    if (pineCode.includes('strategy(')) {
      return { 
        success: false, 
        error: 'Strategy scripts containing "strategy()" are not supported by the indicator transpiler. Please use PineForge for strategies.' 
      };
    }

    const id = 'custom_sandbox_indicator';
    const name = 'Sandbox Indicator';
    const result = transpileToStandaloneFactory(pineCode, id, name);
    
    if (result && result.success) {
      return {
        success: true,
        jsCode: result.factoryCode
      };
    } else {
      return {
        success: false,
        error: result?.error || 'Unknown compilation error from transpiler.'
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || String(err)
    };
  }
}
