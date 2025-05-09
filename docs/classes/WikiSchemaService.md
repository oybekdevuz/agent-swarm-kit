---
title: docs/api-reference/class/WikiSchemaService
group: docs
---

# WikiSchemaService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: LoggerService
```

### registry

```ts
registry: any
```

### validateShallow

```ts
validateShallow: any
```

Validates basic requirements of a wiki schema

### register

```ts
register: (key: string, value: IWikiSchema) => void
```

Registers a wiki schema with a given key

### override

```ts
override: (key: string, value: Partial<IWikiSchema>) => IWikiSchema
```

Overrides an existing wiki schema with a new value for a given key

### get

```ts
get: (key: string) => IWikiSchema
```

Retrieves a wiki schema by key
