import { aws_apigateway as apigateway, Stack } from 'aws-cdk-lib';
import {
  ContentObject,
  RequestBodyObject,
  ResponsesObject,
  ReferenceObject,
  ISpecificationExtension,
  DiscriminatorObject,
  XmlObject,
  ExternalDocumentationObject,
} from 'openapi3-ts';

import { JsonSchemaEx } from '../json-schema-ex';
import { IRestApiWithSpec, MethodResponseWithSpec } from '../models';
import { resolveResourceId } from './utils';

/**
 * Converts a given {@link JsonSchemaEx} into a `SchemaObject` defined in
 * {@link https://github.com/metadevpro/openapi3-ts | openapi3-ts}.
 *
 * @remarks
 *
 * The following properties in `schema` are ignored,
 * ```
 * - additionalItems
 * - contains
 * - definitions
 * - dependencies
 * - id
 * - patternProperties
 * - propertyNames
 * - schema
 * ```
 *
 * If `ref` is presented, other properties will be ignored and a
 * `ReferenceObject` will be returned.
 *
 * If `items` is an array of
 * {@link https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.JsonSchemaType.html | aws_apigateway.JsonSchemaType},
 * it will be ignored.
 *
 * If `type` is an array of
 * {@link https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.JsonSchemaType.html | aws_apigateway.JsonSchemaType},
 * it is treated as an 'array' type.
 *
 * @internal
 */
export function jsonSchemaToSchemaObject(
  schema: JsonSchemaEx,
): SchemaObject | ReferenceObject {
  const {
    additionalItems,
    additionalProperties,
    allOf,
    anyOf,
    contains,
    default: propDefault,
    definitions,
    dependencies,
    description,
    enum: propEnum,
    example,
    exclusiveMaximum,
    exclusiveMinimum,
    format,
    id,
    items,
    maxItems,
    maxLength,
    maxProperties,
    maximum,
    minItems,
    minLength,
    minProperties,
    minimum,
    multipleOf,
    not,
    oneOf,
    pattern,
    patternProperties,
    properties,
    propertyNames,
    ref,
    required,
    // schema is completely ignored
    title,
    type,
    uniqueItems,
  } = schema;
  function warn(...args: any[]) {
    console.warn('jsonSchemaToSchemaObject', ...args);
  }
  if (additionalItems != null) {
    warn('additionalItems is specified but ignored', additionalItems);
  }
  if (contains != null) {
    warn('contains is specified but ignored', contains);
  }
  if (definitions != null) {
    warn('definitions is specified but ignored', definitions);
  }
  if (dependencies != null) {
    warn('dependencies is specified but ignored', dependencies);
  }
  if (id != null) {
    warn('id is specified but ignored', id);
  }
  if (patternProperties != null) {
    warn('patternProperties is specified but ignored', patternProperties);
  }
  if (propertyNames != null) {
    warn('propertyNames is specified but ignored', propertyNames);
  }
  if (ref != null) {
    // ignores other properties and returns a ReferenceObject
    const otherProps = Object.keys(schema).filter((key) => key != 'ref');
    if (otherProps.length > 0) {
      warn('other properties than ref are ignored', otherProps);
    }
    return {
      $ref: ref,
    };
  }
  return {
    additionalProperties: mapAdditionalProperties(additionalProperties),
    allOf: allOf && allOf.map(jsonSchemaToSchemaObject),
    anyOf: anyOf && anyOf.map(jsonSchemaToSchemaObject),
    default: propDefault,
    description,
    enum: propEnum,
    example,
    exclusiveMaximum,
    exclusiveMinimum,
    format,
    items: mapItems(items),
    maxItems,
    maxLength,
    maxProperties,
    maximum,
    minItems,
    minLength,
    minProperties,
    minimum,
    multipleOf,
    not: not && jsonSchemaToSchemaObject(not),
    oneOf: oneOf && oneOf.map(jsonSchemaToSchemaObject),
    pattern,
    properties: mapProperties(properties),
    required,
    title,
    type: mapType(type),
    uniqueItems,
  };
}

function mapAdditionalProperties(
  additionalProperties: JsonSchemaEx | boolean | undefined,
): SchemaObject | boolean | undefined {
  if (typeof additionalProperties === 'boolean') {
    return additionalProperties;
  }
  return additionalProperties != null
    ? jsonSchemaToSchemaObject(additionalProperties)
    : undefined;
}

function mapItems(
  items: JsonSchemaEx | JsonSchemaEx[] | undefined,
): SchemaObject | undefined {
  if (items == null) {
    return undefined;
  }
  if (Array.isArray(items)) {
    console.warn(
      'jsonSchemaToSchemaObject',
      'JsonSchemaEx[] as items is ignored',
      items,
    );
    return undefined;
  }
  return jsonSchemaToSchemaObject(items);
}

function mapProperties(
  properties: JsonSchemaEx['properties'],
): SchemaObject['properties'] {
  if (properties == null) {
    return undefined;
  }
  const output: SchemaObject['properties'] = {};
  for (const key in properties) {
    output[key] = jsonSchemaToSchemaObject(properties[key]);
  }
  return output;
}

function mapType(
  type?: apigateway.JsonSchemaType | apigateway.JsonSchemaType[] | undefined,
): SchemaObjectType | SchemaObjectType[] | undefined {
  if (type == null) {
    return undefined;
  }

  for (const oneType of Array.isArray(type) ? type : [type]) {
    switch (oneType) {
      case apigateway.JsonSchemaType.NULL:
      case apigateway.JsonSchemaType.BOOLEAN:
      case apigateway.JsonSchemaType.OBJECT:
      case apigateway.JsonSchemaType.ARRAY:
      case apigateway.JsonSchemaType.NUMBER:
      case apigateway.JsonSchemaType.INTEGER:
      case apigateway.JsonSchemaType.STRING:
        break;
      default:
        // shoud not be here
        throw new RangeError(`unknown JsonSchemaType: ${oneType}`);
    }
  }

  return type;
}

/**
 * Converts given request models into `RequestBodyObject` defined in
 * {@link https://github.com/metadevpro/openapi3-ts | openapi3-ts}.
 *
 * @param restApi -
 *
 *   {@link https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.IRestApi.html | aws_apigateway.IRestApi}
 *   that defines models.
 *
 * @internal
 */
export function requestModelsToRequestBody(
  restApi: IRestApiWithSpec,
  requestModels: { [contentType: string]: apigateway.IModel },
): RequestBodyObject {
  return {
    content: modelMapToContentObject(
      Stack.of(restApi),
      requestModels,
      restApi.buildOptions?.usePhysicalName,
    ),
  };
}

/**
 * Converts given method responses into `ResponsesObject` defined in
 * {@link https://github.com/metadevpro/openapi3-ts | openapi3-ts}.
 *
 * @param restApi -
 *
 *   {@link https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigateway.IRestApi.html | aws_apigateway.IRestApi} that defines models.
 *
 * @internal
 */
export function methodResponsesToResponses(
  restApi: IRestApiWithSpec,
  methodResponses: MethodResponseWithSpec[],
): ResponsesObject {
  const stack = Stack.of(restApi);
  const responses: ResponsesObject = {};
  for (const response of methodResponses) {
    const { description, responseModels, statusCode } = response;
    responses[statusCode] = {
      description: description ?? `${statusCode} response`,
      content:
        responseModels &&
        modelMapToContentObject(
          stack,
          responseModels,
          restApi.buildOptions?.usePhysicalName,
        ),
    };
  }
  return responses;
}

/**
 * Converts a given model map into a `ContentObject` defined in `openapi3-ts`.
 */
function modelMapToContentObject(
  stack: Stack,
  modelMap: { [contentType: string]: apigateway.IModel },
  usePhysicalName?: boolean,
): ContentObject {
  const content: ContentObject = {};
  for (const contentType in modelMap) {
    const model = modelMap[contentType];
    try {
      content[contentType] = {
        schema: {
          $ref: `#/components/schemas/${
            usePhysicalName && 'physicalName' in model
              ? (model as any as { physicalName: string }).physicalName
              : resolveResourceId(stack, model.modelId)
          }`,
        },
      };
    } catch (exception) {
      // ignore error and return empty schema
      content[contentType] = {
        schema: {},
      };
    }
  }
  return content;
}

type SchemaObjectType =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'null'
  | 'array';

export interface SchemaObject extends ISpecificationExtension {
  nullable?: boolean;
  discriminator?: DiscriminatorObject;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: XmlObject;
  externalDocs?: ExternalDocumentationObject;
  example?: any;
  examples?: any[];
  deprecated?: boolean;
  type?: SchemaObjectType | SchemaObjectType[];
  format?:
    | 'int32'
    | 'int64'
    | 'float'
    | 'double'
    | 'byte'
    | 'binary'
    | 'date'
    | 'date-time'
    | 'password'
    | string;
  allOf?: (SchemaObject | ReferenceObject)[];
  oneOf?: (SchemaObject | ReferenceObject)[];
  anyOf?: (SchemaObject | ReferenceObject)[];
  not?: SchemaObject | ReferenceObject;
  items?: SchemaObject | ReferenceObject;
  properties?: {
    [propertyName: string]: SchemaObject | ReferenceObject;
  };
  additionalProperties?: SchemaObject | ReferenceObject | boolean;
  description?: string;
  default?: any;
  title?: string;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
}
