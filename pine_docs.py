import sys
import difflib

# Ensure UTF-8 stdout on Windows to prevent UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Expanded offline dictionary of 100+ key Pine Script v5/v6 functions
PINE_DOCS_DATABASE = {
    # --- TECHNICAL INDICATORS & ANALYSIS (ta.*) ---
    "ta.sma": {
        "syntax": "ta.sma(source, length) → series float",
        "description": "Simple Moving Average. Returns the moving average of a series of values over a specified number of bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
        ],
        "example": "plot(ta.sma(close, 20))"
    },
    "ta.ema": {
        "syntax": "ta.ema(source, length) → series float",
        "description": "Exponential Moving Average. Returns the exponentially weighted moving average, giving more weight to recent prices.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "plot(ta.ema(close, 14))"
    },
    "ta.wma": {
        "syntax": "ta.wma(source, length) → series float",
        "description": "Weighted Moving Average. Returns the weighted moving average of source with weights decreasing linearly.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "plot(ta.wma(close, 15))"
    },
    "ta.hma": {
        "syntax": "ta.hma(source, length) → series float",
        "description": "Hull Moving Average. A fast and smooth moving average calculated using weighted moving averages of half and full lengths.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "plot(ta.hma(close, 9))"
    },
    "ta.rsi": {
        "syntax": "ta.rsi(source, length) → series float",
        "description": "Relative Strength Index. Measures the speed and change of price movements, oscillator ranging between 0 and 100.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "RSI period."}
        ],
        "example": "rsiVal = ta.rsi(close, 14)\nplot(rsiVal)"
    },
    "ta.macd": {
        "syntax": "ta.macd(source, fast, slow, signal) → [series float, series float, series float]",
        "description": "Moving Average Convergence Divergence. Returns the MACD line, signal line, and histogram value.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values."},
            {"name": "fast", "type": "simple int", "desc": "Fast EMA length."},
            {"name": "slow", "type": "simple int", "desc": "Slow EMA length."},
            {"name": "signal", "type": "simple int", "desc": "Signal smoothing length."}
        ],
        "example": "[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)"
    },
    "ta.atr": {
        "syntax": "ta.atr(length) → series float",
        "description": "Average True Range. Returns the exponential moving average of the true range of the bars.",
        "arguments": [
            {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
        ],
        "example": "plot(ta.atr(14))"
    },
    "ta.stoch": {
        "syntax": "ta.stoch(source, high, low, length) → series float",
        "description": "Stochastic oscillator. Returns %K value.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Typically close price."},
            {"name": "high", "type": "series float", "desc": "High price series."},
            {"name": "low", "type": "series float", "desc": "Low price series."},
            {"name": "length", "type": "simple int", "desc": "Stochastic period."}
        ],
        "example": "k = ta.stoch(close, high, low, 14)"
    },
    "ta.cci": {
        "syntax": "ta.cci(source, length) → series float",
        "description": "Commodity Channel Index. Measures the position of price relative to its average over a given period.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values."},
            {"name": "length", "type": "simple int", "desc": "CCI length."}
        ],
        "example": "cciVal = ta.cci(close, 20)"
    },
    "ta.vwap": {
        "syntax": "ta.vwap(source) → series float",
        "description": "Volume Weighted Average Price. Computes the ratio of cumulative value traded to cumulative volume.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Typically close price."}
        ],
        "example": "plot(ta.vwap(close))"
    },
    "ta.highest": {
        "syntax": "ta.highest(source, length) → series float",
        "description": "Highest value. Returns the maximum value of a series within the specified length.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "highestClose = ta.highest(close, 20)"
    },
    "ta.lowest": {
        "syntax": "ta.lowest(source, length) → series float",
        "description": "Lowest value. Returns the minimum value of a series within the specified length.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "lowestClose = ta.lowest(close, 20)"
    },
    "ta.crossover": {
        "syntax": "ta.crossover(source1, source2) → series bool",
        "description": "Returns true if source1 crossed source2 from below to above, false otherwise.",
        "arguments": [
            {"name": "source1", "type": "series float", "desc": "First series."},
            {"name": "source2", "type": "series float", "desc": "Second series."}
        ],
        "example": "buy = ta.crossover(ta.sma(close, 9), ta.sma(close, 21))"
    },
    "ta.crossunder": {
        "syntax": "ta.crossunder(source1, source2) → series bool",
        "description": "Returns true if source1 crossed source2 from above to below, false otherwise.",
        "arguments": [
            {"name": "source1", "type": "series float", "desc": "First series."},
            {"name": "source2", "type": "series float", "desc": "Second series."}
        ],
        "example": "sell = ta.crossunder(ta.sma(close, 9), ta.sma(close, 21))"
    },
    "ta.stdev": {
        "syntax": "ta.stdev(source, length) → series float",
        "description": "Standard Deviation. Computes the standard deviation of a series.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series to calculate standard deviation on."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "sd = ta.stdev(close, 20)"
    },
    "ta.change": {
        "syntax": "ta.change(source, length) → series float",
        "description": "Difference between current source value and its value 'length' bars ago.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series to calculate change on."},
            {"name": "length", "type": "simple int", "desc": "Offset in bars (default: 1)."}
        ],
        "example": "priceDiff = ta.change(close)"
    },
    "ta.pivothigh": {
        "syntax": "ta.pivothigh(source, leftbars, rightbars) → series float",
        "description": "Returns price of the pivot high point if found, NaN otherwise.",
        "arguments": [
            {"name": "source", "type": "series float/int", "desc": "Usually high price."},
            {"name": "leftbars", "type": "series int", "desc": "Required bars to the left."},
            {"name": "rightbars", "type": "series int", "desc": "Required bars to the right."}
        ],
        "example": "ph = ta.pivothigh(high, 5, 5)"
    },
    "ta.pivotlow": {
        "syntax": "ta.pivotlow(source, leftbars, rightbars) → series float",
        "description": "Returns price of the pivot low point if found, NaN otherwise.",
        "arguments": [
            {"name": "source", "type": "series float/int", "desc": "Usually low price."},
            {"name": "leftbars", "type": "series int", "desc": "Required bars to the left."},
            {"name": "rightbars", "type": "series int", "desc": "Required bars to the right."}
        ],
        "example": "pl = ta.pivotlow(low, 5, 5)"
    },
    "ta.mom": {
        "syntax": "ta.mom(source, length) → series float",
        "description": "Momentum of a series. Returns difference: source - source[length].",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "m = ta.mom(close, 10)"
    },
    "ta.roc": {
        "syntax": "ta.roc(source, length) → series float",
        "description": "Rate of Change. Returns the percentage change of source over length bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "pctChange = ta.roc(close, 10)"
    },
    "ta.trix": {
        "syntax": "ta.trix(source, length) → series float",
        "description": "TRIX oscillator. Triple exponentially smoothed 1-bar ROC of closing price.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Length of exponential moving average."}
        ],
        "example": "t = ta.trix(close, 9)"
    },
    "ta.tsi": {
        "syntax": "ta.tsi(source, short_len, long_len) → series float",
        "description": "True Strength Index. Momentum oscillator mapping technical trends.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "short_len", "type": "simple int", "desc": "Short smoothing EMA length."},
            {"name": "long_len", "type": "simple int", "desc": "Long smoothing EMA length."}
        ],
        "example": "tsiVal = ta.tsi(close, 13, 25)"
    },
    "ta.mfi": {
        "syntax": "ta.mfi(source, length) → series float",
        "description": "Money Flow Index. Volume-weighted oscillator measuring flow of money.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series (usually hlc3)."},
            {"name": "length", "type": "simple int", "desc": "Period."}
        ],
        "example": "mfiVal = ta.mfi(hlc3, 14)"
    },
    "ta.obv": {
        "syntax": "ta.obv(source) → series float",
        "description": "On-Balance Volume. Cumulative total volume corresponding to positive/negative closing bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input price series."}
        ],
        "example": "plot(ta.obv(close))"
    },
    "ta.adx": {
        "syntax": "ta.adx(dirmov_len, adx_len) → [series float, series float, series float]",
        "description": "Average Directional Index. Returns ADX line, +DI, and -DI values.",
        "arguments": [
            {"name": "dirmov_len", "type": "simple int", "desc": "Directional movement length."},
            {"name": "adx_len", "type": "simple int", "desc": "ADX smoothing length."}
        ],
        "example": "[adxVal, plusDI, minusDI] = ta.adx(14, 14)"
    },
    "ta.bb": {
        "syntax": "ta.bb(series, length, mult) → [series float, series float, series float]",
        "description": "Bollinger Bands. Returns middle, upper, and lower bands.",
        "arguments": [
            {"name": "series", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Band period."},
            {"name": "mult", "type": "simple float", "desc": "Standard deviation multiplier."}
        ],
        "example": "[basis, upper, lower] = ta.bb(close, 20, 2.0)"
    },
    "ta.bbw": {
        "syntax": "ta.bbw(series, length, mult) → series float",
        "description": "Bollinger Bands Width. Returns the width of the Bollinger Bands.",
        "arguments": [
            {"name": "series", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Band period."},
            {"name": "mult", "type": "simple float", "desc": "Multiplier."}
        ],
        "example": "width = ta.bbw(close, 20, 2.0)"
    },
    "ta.kc": {
        "syntax": "ta.kc(series, length, mult) → [series float, series float, series float]",
        "description": "Keltner Channels. Returns middle, upper, and lower bands using ATR.",
        "arguments": [
            {"name": "series", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Keltner channel length."},
            {"name": "mult", "type": "simple float", "desc": "ATR multiplier."}
        ],
        "example": "[basis, upper, lower] = ta.kc(close, 20, 1.5)"
    },
    "ta.supertrend": {
        "syntax": "ta.supertrend(factor, atr_period) → [series float, series float]",
        "description": "Supertrend indicator. Returns the Supertrend line and trend direction (+1 or -1).",
        "arguments": [
            {"name": "factor", "type": "simple float", "desc": "ATR multiplier."},
            {"name": "atr_period", "type": "simple int", "desc": "ATR period."}
        ],
        "example": "[superTrend, direction] = ta.supertrend(3.0, 10)"
    },
    "ta.cog": {
        "syntax": "ta.cog(source, length) → series float",
        "description": "Center of Gravity indicator. Measures momentum with minimal lag.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Period."}
        ],
        "example": "c = ta.cog(close, 10)"
    },
    "ta.falling": {
        "syntax": "ta.falling(source, length) → series bool",
        "description": "Returns true if source decreases for 'length' consecutive bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Consecutive bars check."}
        ],
        "example": "isFalling = ta.falling(close, 3)"
    },
    "ta.rising": {
        "syntax": "ta.rising(source, length) → series bool",
        "description": "Returns true if source increases for 'length' consecutive bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Consecutive bars check."}
        ],
        "example": "isRising = ta.rising(close, 3)"
    },
    "ta.variance": {
        "syntax": "ta.variance(source, length) → series float",
        "description": "Variance. Computes the variance of a series of values over length bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "v = ta.variance(close, 20)"
    },
    "ta.covariance": {
        "syntax": "ta.covariance(source1, source2, length) → series float",
        "description": "Covariance. Returns covariance between two series over length bars.",
        "arguments": [
            {"name": "source1", "type": "series float", "desc": "First series."},
            {"name": "source2", "type": "series float", "desc": "Second series."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "cov = ta.covariance(close, open, 20)"
    },
    "ta.correlation": {
        "syntax": "ta.correlation(source1, source2, length) → series float",
        "description": "Correlation. Returns Pearson correlation coefficient between two series.",
        "arguments": [
            {"name": "source1", "type": "series float", "desc": "First series."},
            {"name": "source2", "type": "series float", "desc": "Second series."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "corr = ta.correlation(close, open, 20)"
    },
    "ta.percentrank": {
        "syntax": "ta.percentrank(source, length) → series float",
        "description": "Percent Rank. Returns percentage of values in the window that are less than or equal to source.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Window size."}
        ],
        "example": "rank = ta.percentrank(close, 100)"
    },
    "ta.range": {
        "syntax": "ta.range(source, length) → series float",
        "description": "Returns the difference between maximum and minimum values of a series over length bars.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Input series."},
            {"name": "length", "type": "simple int", "desc": "Number of bars."}
        ],
        "example": "r = ta.range(close, 10)"
    },

    # --- ARRAYS (array.*) ---
    "array.new_float": {
        "syntax": "array.new_float(size, initial_value) → float[]",
        "description": "Creates a new array of float elements.",
        "arguments": [
            {"name": "size", "type": "simple int", "desc": "Initial array size."},
            {"name": "initial_value", "type": "float", "desc": "Optional default value."}
        ],
        "example": "myArr = array.new_float(10, 0.0)"
    },
    "array.new_int": {
        "syntax": "array.new_int(size, initial_value) → int[]",
        "description": "Creates a new array of integer elements.",
        "arguments": [
            {"name": "size", "type": "simple int", "desc": "Initial size."},
            {"name": "initial_value", "type": "int", "desc": "Optional default value."}
        ],
        "example": "myArr = array.new_int(5, 1)"
    },
    "array.new_bool": {
        "syntax": "array.new_bool(size, initial_value) → bool[]",
        "description": "Creates a new array of boolean elements.",
        "arguments": [
            {"name": "size", "type": "simple int", "desc": "Initial size."},
            {"name": "initial_value", "type": "bool", "desc": "Optional default value."}
        ],
        "example": "myArr = array.new_bool(5, false)"
    },
    "array.new_string": {
        "syntax": "array.new_string(size, initial_value) → string[]",
        "description": "Creates a new array of string elements.",
        "arguments": [
            {"name": "size", "type": "simple int", "desc": "Initial size."},
            {"name": "initial_value", "type": "string", "desc": "Optional default value."}
        ],
        "example": "myArr = array.new_string(2, 'Init')"
    },
    "array.push": {
        "syntax": "array.push(id, value) → void",
        "description": "Appends a new element to the end of the array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID variable."},
            {"name": "value", "type": "type of element", "desc": "Value to append."}
        ],
        "example": "array.push(myArr, close)"
    },
    "array.pop": {
        "syntax": "array.pop(id) → element type",
        "description": "Removes and returns the last element from the array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."}
        ],
        "example": "lastVal = array.pop(myArr)"
    },
    "array.shift": {
        "syntax": "array.shift(id) → element type",
        "description": "Removes and returns the first element from the array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."}
        ],
        "example": "firstVal = array.shift(myArr)"
    },
    "array.unshift": {
        "syntax": "array.unshift(id, value) → void",
        "description": "Prepends a new element to the beginning of the array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "value", "type": "element type", "desc": "Value to prepend."}
        ],
        "example": "array.unshift(myArr, open)"
    },
    "array.insert": {
        "syntax": "array.insert(id, index, value) → void",
        "description": "Inserts a new value into the array at a specific index.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "index", "type": "int", "desc": "Index where the value is inserted."},
            {"name": "value", "type": "element type", "desc": "Value to insert."}
        ],
        "example": "array.insert(myArr, 0, 1.25)"
    },
    "array.remove": {
        "syntax": "array.remove(id, index) → element type",
        "description": "Removes the element at a specific index and returns it.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "index", "type": "int", "desc": "Index of element to remove."}
        ],
        "example": "val = array.remove(myArr, 2)"
    },
    "array.get": {
        "syntax": "array.get(id, index) → element type",
        "description": "Returns the element at the specified index.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "index", "type": "int", "desc": "Index of element to fetch."}
        ],
        "example": "val = array.get(myArr, 0)"
    },
    "array.set": {
        "syntax": "array.set(id, index, value) → void",
        "description": "Sets the value of the element at the specified index.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "index", "type": "int", "desc": "Index to modify."},
            {"name": "value", "type": "element type", "desc": "New value."}
        ],
        "example": "array.set(myArr, 0, close)"
    },
    "array.size": {
        "syntax": "array.size(id) → series int",
        "description": "Returns the number of elements in the array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."}
        ],
        "example": "len = array.size(myArr)"
    },
    "array.clear": {
        "syntax": "array.clear(id) → void",
        "description": "Removes all elements from the array (sets size to 0).",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."}
        ],
        "example": "array.clear(myArr)"
    },
    "array.join": {
        "syntax": "array.join(id, separator) → series string",
        "description": "Concatenates all array elements into a single string separated by separator.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "separator", "type": "string", "desc": "Delimiter string."}
        ],
        "example": "str = array.join(myArr, ', ')"
    },
    "array.sort": {
        "syntax": "array.sort(id, order) → void",
        "description": "Sorts the elements of the array in ascending or descending order.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "order", "type": "order.ascending/order.descending", "desc": "Sorting direction (default: order.ascending)."}
        ],
        "example": "array.sort(myArr, order.descending)"
    },
    "array.reverse": {
        "syntax": "array.reverse(id) → void",
        "description": "Reverses the order of elements in the array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."}
        ],
        "example": "array.reverse(myArr)"
    },
    "array.slice": {
        "syntax": "array.slice(id, index_from, index_to) → array type",
        "description": "Returns a shallow copy of a portion of an array.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "index_from", "type": "int", "desc": "Starting index."},
            {"name": "index_to", "type": "int", "desc": "Ending index (excluded)."}
        ],
        "example": "subArr = array.slice(myArr, 0, 3)"
    },
    "array.fill": {
        "syntax": "array.fill(id, value, index_from, index_to) → void",
        "description": "Fills array elements with a single value.",
        "arguments": [
            {"name": "id", "type": "array type", "desc": "Array ID."},
            {"name": "value", "type": "element type", "desc": "Value to fill with."},
            {"name": "index_from", "type": "int", "desc": "Start index (optional)."},
            {"name": "index_to", "type": "int", "desc": "End index (optional)."}
        ],
        "example": "array.fill(myArr, 0.0)"
    },

    # --- MATRICES (matrix.*) ---
    "matrix.new_float": {
        "syntax": "matrix.new_float(rows, cols, initial_value) → matrix float",
        "description": "Creates a new matrix of float elements.",
        "arguments": [
            {"name": "rows", "type": "int", "desc": "Number of rows."},
            {"name": "cols", "type": "int", "desc": "Number of columns."},
            {"name": "initial_value", "type": "float", "desc": "Optional initial cell value."}
        ],
        "example": "m = matrix.new_float(3, 3, 0.0)"
    },
    "matrix.new_int": {
        "syntax": "matrix.new_int(rows, cols, initial_value) → matrix int",
        "description": "Creates a new matrix of integer elements.",
        "arguments": [
            {"name": "rows", "type": "int", "desc": "Number of rows."},
            {"name": "cols", "type": "int", "desc": "Number of columns."},
            {"name": "initial_value", "type": "int", "desc": "Optional initial cell value."}
        ],
        "example": "m = matrix.new_int(2, 2, 1)"
    },
    "matrix.get": {
        "syntax": "matrix.get(id, row, col) → element type",
        "description": "Returns the element at the specified row and column coordinates.",
        "arguments": [
            {"name": "id", "type": "matrix type", "desc": "Matrix ID variable."},
            {"name": "row", "type": "int", "desc": "Row index (0-indexed)."},
            {"name": "col", "type": "int", "desc": "Column index (0-indexed)."}
        ],
        "example": "cell = matrix.get(m, 0, 1)"
    },
    "matrix.set": {
        "syntax": "matrix.set(id, row, col, value) → void",
        "description": "Sets the value of a matrix element at specified coordinates.",
        "arguments": [
            {"name": "id", "type": "matrix type", "desc": "Matrix ID."},
            {"name": "row", "type": "int", "desc": "Row index."},
            {"name": "col", "type": "int", "desc": "Column index."},
            {"name": "value", "type": "element type", "desc": "New value."}
        ],
        "example": "matrix.set(m, 0, 0, 1.25)"
    },
    "matrix.rows": {
        "syntax": "matrix.rows(id) → series int",
        "description": "Returns the number of rows in the matrix.",
        "arguments": [
            {"name": "id", "type": "matrix type", "desc": "Matrix ID."}
        ],
        "example": "numRows = matrix.rows(m)"
    },
    "matrix.columns": {
        "syntax": "matrix.columns(id) → series int",
        "description": "Returns the number of columns in the matrix.",
        "arguments": [
            {"name": "id", "type": "matrix type", "desc": "Matrix ID."}
        ],
        "example": "numCols = matrix.columns(m)"
    },
    "matrix.add_col": {
        "syntax": "matrix.add_col(id, col_index, array_id) → void",
        "description": "Inserts a new column into the matrix using values from an array.",
        "arguments": [
            {"name": "id", "type": "matrix type", "desc": "Matrix ID."},
            {"name": "col_index", "type": "int", "desc": "Column index to insert at."},
            {"name": "array_id", "type": "array type", "desc": "Array of values."}
        ],
        "example": "matrix.add_col(m, 0, myArr)"
    },
    "matrix.add_row": {
        "syntax": "matrix.add_row(id, row_index, array_id) → void",
        "description": "Inserts a new row into the matrix using values from an array.",
        "arguments": [
            {"name": "id", "type": "matrix type", "desc": "Matrix ID."},
            {"name": "row_index", "type": "int", "desc": "Row index to insert at."},
            {"name": "array_id", "type": "array type", "desc": "Array of values."}
        ],
        "example": "matrix.add_row(m, 0, myArr)"
    },

    # --- REQUESTS / MULTI-TIMEFRAME (request.*) ---
    "request.security": {
        "syntax": "request.security(symbol, timeframe, expression, gaps, lookahead) → series type",
        "description": "Fetches data from another symbol and/or timeframe.",
        "arguments": [
            {"name": "symbol", "type": "simple string", "desc": "Target ticker (e.g., 'BINANCE:ETHUSDT')."},
            {"name": "timeframe", "type": "simple string", "desc": "Target interval (e.g., 'D', '240', '60')."},
            {"name": "expression", "type": "series float/int/bool", "desc": "Variables or expressions to fetch."}
        ],
        "example": "dailyClose = request.security(syminfo.tickerid, 'D', close)"
    },
    "request.financial": {
        "syntax": "request.financial(symbol, financial_id, period) → series float",
        "description": "Requests financial data of specified ID for a stock/corporation.",
        "arguments": [
            {"name": "symbol", "type": "simple string", "desc": "Ticker symbol."},
            {"name": "financial_id", "type": "simple string", "desc": "Financial identifier metric."},
            {"name": "period", "type": "simple string", "desc": "Reporting period ('FY', 'FQ', 'TTM')."}
        ],
        "example": "eps = request.financial(syminfo.tickerid, 'EARNINGS_PER_SHARE', 'FQ')"
    },
    "request.dividends": {
        "syntax": "request.dividends(symbol, dividend_type) → series float",
        "description": "Requests historical dividend payout values.",
        "arguments": [
            {"name": "symbol", "type": "simple string", "desc": "Ticker symbol."},
            {"name": "dividend_type", "type": "simple string", "desc": "Dividend type ('cash', 'stock', etc.)."}
        ],
        "example": "div = request.dividends(syminfo.tickerid, 'cash')"
    },
    "request.earnings": {
        "syntax": "request.earnings(symbol, earnings_type) → series float",
        "description": "Requests historical corporation earnings.",
        "arguments": [
            {"name": "symbol", "type": "simple string", "desc": "Ticker symbol."},
            {"name": "earnings_type", "type": "simple string", "desc": "Type of earnings data."}
        ],
        "example": "earn = request.earnings(syminfo.tickerid, 'actual')"
    },

    # --- PLOTTING & GRAPHICS (plot*) ---
    "plot": {
        "syntax": "plot(series, title, color, linewidth, style, trackprice) → plot",
        "description": "Plots a series of data on the chart canvas.",
        "arguments": [
            {"name": "series", "type": "series float", "desc": "Values to plot."},
            {"name": "title", "type": "const string", "desc": "Plot label."},
            {"name": "color", "type": "color", "desc": "Line/bar color."}
        ],
        "example": "plot(close, title='Close Line', color=color.blue)"
    },
    "plotshape": {
        "syntax": "plotshape(series, title, style, location, color, size, text) → void",
        "description": "Plots technical shapes (circles, arrows, triangles) on the chart.",
        "arguments": [
            {"name": "series", "type": "series bool", "desc": "Condition mapping to plot shape (true triggers plot)."},
            {"name": "style", "type": "shape style", "desc": "Shape design (shape.triangleup, shape.xcross)."},
            {"name": "location", "type": "location style", "desc": "Vertical positioning (location.abovebar)."}
        ],
        "example": "plotshape(ta.crossover(close, open), style=shape.triangleup, location=location.belowbar, color=color.green)"
    },
    "plotchar": {
        "syntax": "plotchar(series, title, char, location, color, size, text) → void",
        "description": "Plots arbitrary Unicode characters on the chart according to boolean conditions.",
        "arguments": [
            {"name": "series", "type": "series bool", "desc": "Trigger condition."},
            {"name": "char", "type": "const string", "desc": "Unicode symbol string."}
        ],
        "example": "plotchar(buyCondition, char='🟢', location=location.belowbar)"
    },
    "plotarrow": {
        "syntax": "plotarrow(series, title, colorup, colordown, maxval) → void",
        "description": "Plots arrows based on numeric values (positive values point up, negative point down).",
        "arguments": [
            {"name": "series", "type": "series float", "desc": "Numeric signal value."}
        ],
        "example": "plotarrow(close - open, colorup=color.green, colordown=color.red)"
    },
    "plotbar": {
        "syntax": "plotbar(open, high, low, close, title, color) → void",
        "description": "Plots custom OHLC bars onto the chart canvas.",
        "arguments": [
            {"name": "open", "type": "series float", "desc": "Open price."}
        ],
        "example": "plotbar(open, high, low, close, color=color.black)"
    },
    "plotcandle": {
        "syntax": "plotcandle(open, high, low, close, title, color, wickcolor) → void",
        "description": "Plots custom candlestick bars.",
        "arguments": [
            {"name": "open", "type": "series float", "desc": "Open price."}
        ],
        "example": "plotcandle(open, high, low, close, color=color.teal)"
    },

    # --- DRAWING OBJECTS (line.*, box.*, label.*) ---
    "line.new": {
        "syntax": "line.new(x1, y1, x2, y2, xloc, extend, color, style, width) → line",
        "description": "Creates a new dynamic line drawing object on the chart.",
        "arguments": [
            {"name": "x1", "type": "int", "desc": "Start point X coordinate (bar index or timestamp)."},
            {"name": "y1", "type": "float", "desc": "Start point Y price coordinate."}
        ],
        "example": "l = line.new(bar_index[10], low[10], bar_index, low, color=color.red)"
    },
    "line.set_xy1": {
        "syntax": "line.set_xy1(id, x, y) → void",
        "description": "Updates start point coordinates of a line object.",
        "arguments": [
            {"name": "id", "type": "line type", "desc": "Line object ID variable."}
        ],
        "example": "line.set_xy1(l, bar_index, close)"
    },
    "line.set_xy2": {
        "syntax": "line.set_xy2(id, x, y) → void",
        "description": "Updates endpoint coordinates of a line object.",
        "arguments": [
            {"name": "id", "type": "line type", "desc": "Line object ID."}
        ],
        "example": "line.set_xy2(l, bar_index + 10, close)"
    },
    "line.set_color": {
        "syntax": "line.set_color(id, color) → void",
        "description": "Modifies the color of a line object.",
        "arguments": [
            {"name": "id", "type": "line", "desc": "Line ID."}
        ],
        "example": "line.set_color(l, color.yellow)"
    },
    "line.delete": {
        "syntax": "line.delete(id) → void",
        "description": "Deletes the specified line drawing object from the chart.",
        "arguments": [
            {"name": "id", "type": "line", "desc": "Line ID."}
        ],
        "example": "line.delete(l)"
    },
    "box.new": {
        "syntax": "box.new(left, top, right, bottom, border_color, border_width, bgcolor) → box",
        "description": "Draws a rectangular box overlay on the chart.",
        "arguments": [
            {"name": "left", "type": "int", "desc": "Left edge X coordinate."},
            {"name": "top", "type": "float", "desc": "Top edge Y coordinate."}
        ],
        "example": "b = box.new(bar_index - 5, high, bar_index, low, bgcolor=color.new(color.green, 90))"
    },
    "box.set_left": {
        "syntax": "box.set_left(id, left) → void",
        "description": "Updates the left coordinate of a box.",
        "arguments": [
            {"name": "id", "type": "box", "desc": "Box ID."}
        ],
        "example": "box.set_left(b, bar_index - 10)"
    },
    "box.set_right": {
        "syntax": "box.set_right(id, right) → void",
        "description": "Updates the right coordinate of a box.",
        "arguments": [
            {"name": "id", "type": "box", "desc": "Box ID."}
        ],
        "example": "box.set_right(b, bar_index)"
    },
    "box.set_top": {
        "syntax": "box.set_top(id, top) → void",
        "description": "Updates the top Y coordinate of a box.",
        "arguments": [
            {"name": "id", "type": "box", "desc": "Box ID."}
        ],
        "example": "box.set_top(b, high)"
    },
    "box.set_bottom": {
        "syntax": "box.set_bottom(id, bottom) → void",
        "description": "Updates the bottom Y coordinate of a box.",
        "arguments": [
            {"name": "id", "type": "box", "desc": "Box ID."}
        ],
        "example": "box.set_bottom(b, low)"
    },
    "box.set_color": {
        "syntax": "box.set_color(id, color) → void",
        "description": "Modifies the border color of a box.",
        "arguments": [
            {"name": "id", "type": "box", "desc": "Box ID."}
        ],
        "example": "box.set_color(b, color.red)"
    },
    "box.delete": {
        "syntax": "box.delete(id) → void",
        "description": "Deletes the specified box object.",
        "arguments": [
            {"name": "id", "type": "box", "desc": "Box ID."}
        ],
        "example": "box.delete(b)"
    },
    "label.new": {
        "syntax": "label.new(x, y, text, xloc, yloc, color, style, textcolor) → label",
        "description": "Paints a dynamic text label / callout overlay on the chart.",
        "arguments": [
            {"name": "x", "type": "int", "desc": "X coordinate."},
            {"name": "y", "type": "float", "desc": "Y coordinate."}
        ],
        "example": "lbl = label.new(bar_index, high, text='Signal', color=color.green)"
    },
    "label.set_xy": {
        "syntax": "label.set_xy(id, x, y) → void",
        "description": "Updates coordinates of a label.",
        "arguments": [
            {"name": "id", "type": "label", "desc": "Label ID."}
        ],
        "example": "label.set_xy(lbl, bar_index, close)"
    },
    "label.set_text": {
        "syntax": "label.set_text(id, text) → void",
        "description": "Updates text content inside a label.",
        "arguments": [
            {"name": "id", "type": "label", "desc": "Label ID."}
        ],
        "example": "label.set_text(lbl, 'New Signal')"
    },
    "label.delete": {
        "syntax": "label.delete(id) → void",
        "description": "Deletes the specified label.",
        "arguments": [
            {"name": "id", "type": "label", "desc": "Label ID."}
        ],
        "example": "label.delete(lbl)"
    },

    # --- STRATEGY ORDERS & REPORTING (strategy.*) ---
    "strategy.entry": {
        "syntax": "strategy.entry(id, direction, qty, limit, stop, comment, alert_message) → void",
        "description": "Submits an entry order command to enter market position.",
        "arguments": [
            {"name": "id", "type": "const string", "desc": "Order identifier."},
            {"name": "direction", "type": "strategy.long/strategy.short", "desc": "Long/Short bias."}
        ],
        "example": "strategy.entry('BuyCall', strategy.long)"
    },
    "strategy.exit": {
        "syntax": "strategy.exit(id, from_entry, qty, profit, loss, trail_points) → void",
        "description": "Submits an order command to exit a specific entry or position using stop/limit metrics.",
        "arguments": [
            {"name": "id", "type": "const string", "desc": "Order identifier."},
            {"name": "from_entry", "type": "const string", "desc": "Close entry order ID reference."}
        ],
        "example": "strategy.exit('TP/SL', from_entry='BuyCall', profit=200, loss=100)"
    },
    "strategy.close": {
        "syntax": "strategy.close(id, comment, alert_message) → void",
        "description": "Command to close/exit a specific market entry order immediately on market open.",
        "arguments": [
            {"name": "id", "type": "const string", "desc": "The entry order ID to close."}
        ],
        "example": "strategy.close('BuyCall')"
    },
    "strategy.cancel": {
        "syntax": "strategy.cancel(id) → void",
        "description": "Cancels/deletes a pending limit/stop order by ID.",
        "arguments": [
            {"name": "id", "type": "const string", "desc": "The order ID to cancel."}
        ],
        "example": "strategy.cancel('LimitOrder')"
    },
    "strategy.close_all": {
        "syntax": "strategy.close_all(comment, alert_message) → void",
        "description": "Immediately flattens the entire position, closing all active orders.",
        "arguments": [
            {"name": "comment", "type": "string", "desc": "Optional comment string."}
        ],
        "example": "strategy.close_all('Flattening')"
    },
    "strategy.position_size": {
        "syntax": "strategy.position_size → series float",
        "description": "Returns size of the current open position (positive for long, negative for short).",
        "arguments": [],
        "example": "inPosition = strategy.position_size != 0"
    },

    # --- COLOR SYSTEM (color.*) ---
    "color.new": {
        "syntax": "color.new(color, transp) → color",
        "description": "Creates a new color with transparency level applied (0 is solid, 100 is transparent).",
        "arguments": [
            {"name": "color", "type": "color", "desc": "Base color variable."},
            {"name": "transp", "type": "int", "desc": "Transparency percent value."}
        ],
        "example": "c = color.new(color.green, 50)"
    },
    "color.rgb": {
        "syntax": "color.rgb(red, green, blue, transp) → color",
        "description": "Creates a custom color using RGB values (0-255).",
        "arguments": [
            {"name": "red", "type": "int", "desc": "Red channel (0-255)."}
        ],
        "example": "c = color.rgb(255, 100, 50, 20)"
    },
    "color.from_gradient": {
        "syntax": "color.from_gradient(val, min_val, max_val, color1, color2) → color",
        "description": "Returns color interpolation matching value on a gradient scale.",
        "arguments": [
            {"name": "val", "type": "series float", "desc": "Value to map."}
        ],
        "example": "c = color.from_gradient(rsiVal, 30, 70, color.red, color.green)"
    },

    # --- BASIC MATHEMATICS (math.*) ---
    "math.abs": {
        "syntax": "math.abs(number) → series type",
        "description": "Absolute value. Returns positive value of input.",
        "arguments": [],
        "example": "val = math.abs(-12.5)"
    },
    "math.round": {
        "syntax": "math.round(number, precision) → series type",
        "description": "Rounds a value to the nearest integer or specified decimal precision.",
        "arguments": [
            {"name": "number", "type": "series float", "desc": "Number to round."},
            {"name": "precision", "type": "simple int", "desc": "Decimal places (optional)."}
        ],
        "example": "val = math.round(close, 2)"
    },
    "math.max": {
        "syntax": "math.max(number1, number2, ...) → series type",
        "description": "Returns the maximum of multiple arguments.",
        "arguments": [],
        "example": "val = math.max(high, open, close)"
    },
    "math.min": {
        "syntax": "math.min(number1, number2, ...) → series type",
        "description": "Returns the minimum of multiple arguments.",
        "arguments": [],
        "example": "val = math.min(low, open, close)"
    },

    # --- TIME & TIMEFRAME VARIABLES ---
    "time": {
        "syntax": "time → series int",
        "description": "Returns the current bar's start timestamp in milliseconds (UNIX epoch).",
        "arguments": [],
        "example": "isToday = time >= timestamp(2026, 6, 12, 0, 0)"
    },
    "timeframe.period": {
        "syntax": "timeframe.period → const string",
        "description": "Returns string period representing interval timeframe (e.g. 'D', '60', '1').",
        "arguments": [],
        "example": "isOneHour = timeframe.period == '60'"
    }
}


def get_pine_docs(function_name: str) -> str:
    """Get offline documentation for a Pine Script v5/v6 function with typo suggestions.
    
    Args:
        function_name: E.g. "ta.ema", "ta.rsi", "strategy.entry"
    """
    fn = function_name.strip()
    if fn not in PINE_DOCS_DATABASE:
        # Typo suggestion helper using difflib
        matches = difflib.get_close_matches(fn, PINE_DOCS_DATABASE.keys(), n=3, cutoff=0.5)
        suggestion = ""
        if matches:
            suggestion = f" Did you mean: {', '.join(f'`{m}`' for m in matches)}?"
        else:
            # Fallback to simple namespace check
            parts = fn.split(".")
            if len(parts) > 1:
                ns = parts[0]
                similar = [k for k in PINE_DOCS_DATABASE.keys() if k.startswith(ns)]
                if similar:
                    suggestion = f" Available functions in `{ns}.*`: {', '.join(similar[:5])}"
            
        return f"Documentation for '{fn}' not found in the offline database.{suggestion}\nAvailable functions: {', '.join(sorted(list(PINE_DOCS_DATABASE.keys())[:15]))}..."
        
    info = PINE_DOCS_DATABASE[fn]
    
    lines = [
        f"### 📘 Pine Script Docs: `{fn}`",
        "",
        f"**Syntax:** `{info['syntax']}`",
        "",
        f"**Description:** {info['description']}",
        "",
        "**Arguments:**"
    ]
    
    for arg in info.get("arguments", []):
        lines.append(f"- `{arg['name']}` ({arg['type']}): {arg['desc']}")
        
    lines.extend([
        "",
        "**Example:**",
        "```pinescript",
        info.get("example", ""),
        "```"
    ])
    
    return "\n".join(lines)


def validate_pine_code(code: str) -> str:
    """Analyze a block of Pine Script code for common syntax and structure issues.
    
    Args:
        code: The Pine Script source code as a string.
    """
    if not code or not code.strip():
        return "Error: Pine Script code is empty."
        
    lines = code.split("\n")
    warnings = []
    has_version = False
    version_num = 0
    is_indicator = False
    is_strategy = False
    
    for idx, line in enumerate(lines):
        clean_line = line.strip()
        
        # Check version declaration
        if "//@version=" in clean_line:
            has_version = True
            try:
                version_num = int(clean_line.split("=")[-1])
            except ValueError:
                warnings.append(f"Line {idx+1}: Malformed version declaration.")
                
        # Check indicator or strategy calls
        if "indicator(" in clean_line:
            is_indicator = True
        if "strategy(" in clean_line:
            is_strategy = True
            
        # Check obsolete functions/keywords
        if "study(" in clean_line:
            warnings.append(f"Line {idx+1}: 'study()' is obsolete. Use 'indicator()' in Pine Script v5/v6.")
        if "security(" in clean_line and not "request.security(" in clean_line:
            warnings.append(f"Line {idx+1}: Obsolete 'security()' call. Use 'request.security()' in v5/v6.")
            
        # Unmatched bracket/parenthesis check
        open_p = clean_line.count("(")
        close_p = clean_line.count(")")
        if open_p != close_p:
            warnings.append(f"Line {idx+1}: Unmatched parentheses (open: {open_p}, close: {close_p}).")
            
        open_b = clean_line.count("[")
        close_b = clean_line.count("]")
        if open_b != close_b:
            warnings.append(f"Line {idx+1}: Unmatched square brackets (open: {open_b}, close: {close_b}).")
            
    if not has_version:
        warnings.append("Warning: Missing version compiler directive. Recommend adding '//@version=5' or '//@version=6' at the top of your script.")
    elif version_num < 5:
        warnings.append(f"Warning: Script uses Pine version {version_num}. Upgrading to version 5 or 6 is highly recommended for modern features.")
        
    if not is_indicator and not is_strategy:
        warnings.append("Warning: Script lacks an entry point. Add 'indicator(...)' or 'strategy(...)' call.")
        
    if not warnings:
        return "✅ Pine Script syntax looks good! No obvious syntax errors or version issues detected."
        
    report = [
        "### 🔍 Pine Script Linter Report",
        "",
        f"Found {len(warnings)} potential issue(s):",
        ""
    ]
    for w in warnings:
        report.append(f"- {w}")
        
    return "\n".join(report)


if __name__ == "__main__":
    # Test doc lookup
    print(get_pine_docs("ta.em"))  # Should suggest ta.ema, ta.wma, etc.
    print("\n---")
    print(get_pine_docs("ta.hma"))
