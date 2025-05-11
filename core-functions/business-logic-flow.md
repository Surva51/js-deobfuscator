# Claude CLI Business Logic Flow

This document describes how the core business logic functions of the Claude CLI work together.

## Function Categories

### API Interaction

| Function | Description | Size |
|----------|-------------|------|
| _B6 | Main API interaction handler that processes message content, particularly handling tool_use content. | 224,422 |
| xB6 | Makes a minimal API call to check quota status and update rate limit state. | 762 |
| yB6 | Handles rate limit status changes, notifying subscribers and logging events. | 201 |
| vB6 | React hook that subscribes to rate limit state changes. | 153 |

### System Configuration

| Function | Description | Size |
|----------|-------------|------|
| qS | Generates the system prompt used to set Claude's behavior, containing instructions and rules. | 12,726 |

### Token Management

| Function | Description | Size |
|----------|-------------|------|
| sa5 | Calculates total token usage from various token sources (input, cache, output). | 128 |
| XN | Counts tokens from conversation history. | 126 |
| kB6 | Specifically counts cached tokens from conversation history. | 241 |

### Tool Handling

| Function | Description | Size |
|----------|-------------|------|
| ZK1 | Processes and transforms tool inputs recursively. | 150 |
| oa5 | Maps over message content and transforms tool results and inputs. | 544 |
| fB6 | Formats message content for display, handling different content types. | 368 |

## Function Dependencies

This section shows which functions call other functions.

### XN

**Description**: Counts tokens from conversation history.

**Calls**:
- sa5 (1 times)

**Called by**: No other core functions

### ZK1

**Description**: Processes and transforms tool inputs recursively.

**Calls**: No other core functions

**Called by**:
- fB6 (1 times)
- oa5 (1 times)

### _B6

**Description**: Main API interaction handler that processes message content, particularly handling tool_use content.

**Calls**: No other core functions

**Called by**: No other core functions

### fB6

**Description**: Formats message content for display, handling different content types.

**Calls**:
- ZK1 (1 times)

**Called by**: No other core functions

### kB6

**Description**: Specifically counts cached tokens from conversation history.

**Calls**: No other core functions

**Called by**: No other core functions

### oa5

**Description**: Maps over message content and transforms tool results and inputs.

**Calls**:
- ZK1 (1 times)

**Called by**: No other core functions

### qS

**Description**: Generates the system prompt used to set Claude's behavior, containing instructions and rules.

**Calls**: No other core functions

**Called by**: No other core functions

### sa5

**Description**: Calculates total token usage from various token sources (input, cache, output).

**Calls**: No other core functions

**Called by**:
- XN (1 times)

### vB6

**Description**: React hook that subscribes to rate limit state changes.

**Calls**: No other core functions

**Called by**: No other core functions

### xB6

**Description**: Makes a minimal API call to check quota status and update rate limit state.

**Calls**:
- yB6 (2 times)

**Called by**: No other core functions

### yB6

**Description**: Handles rate limit status changes, notifying subscribers and logging events.

**Calls**: No other core functions

**Called by**:
- xB6 (2 times)

## Main Business Logic Flow

The Claude CLI business logic follows these main steps:

1. **System Prompt Configuration**:
   - The `qS` function generates the system prompt that controls Claude's behavior.
   - This includes instructions, rules, and example interactions.

2. **API Rate Limit Management**:
   - The `xB6` function checks quota status with a minimal API call.
   - The `yB6` function handles rate limit status changes and notifications.
   - The `vB6` hook allows components to subscribe to rate limit state.

3. **Message Processing**:
   - The `_B6` function is the main handler for processing messages.
   - It normalizes tool inputs and handles various message types.

4. **Token Counting**:
   - The `sa5` function calculates total token usage.
   - The `XN` function counts tokens from conversation history.
   - The `kB6` function specifically counts cached tokens.

5. **Tool Handling**:
   - The `ZK1` function processes tool inputs recursively.
   - The `oa5` function maps over message content and transforms it.
   - The `fB6` function formats message content for display.

