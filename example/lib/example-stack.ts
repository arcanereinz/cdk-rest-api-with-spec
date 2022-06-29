import { Stack, StackProps, aws_apigateway as apigateway } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { JsonSchemaEx } from './json-schema-ex';
import { RestApiWithSpec } from './rest-api-with-spec';

/**
 * Provisions a REST API that represents a modified subset of the Pet Store API.
 *
 * The OpenAPI 3.0 definition of the Pet Store API is available at
 * https://github.com/swagger-api/swagger-petstore/blob/master/src/main/resources/openapi.yaml
 */
export class ExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const documentationVersion = '0.0.1';

    const api = RestApiWithSpec.createRestApi(this, 'example-api', {
      description: 'Example of RestApiWithSpec',
      documentationVersion,
      deploy: true,
      deployOptions: {
        stageName: 'staging',
        description: 'Default stage',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 50,
      },
    });

    // validators
    // - full request validator
    const fullRequestValidator = new apigateway.RequestValidator(
      this,
      'FullRequestValidator',
      {
        restApi: api,
        validateRequestBody: true,
        validateRequestParameters: true,
      },
    );

    // models
    // - pet
    const petModel = api.addModel('PetModel', {
      description: 'A pet',
      contentType: 'application/json',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'pet',
        description: 'A pet',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          id: {
            description: 'ID of the pet',
            type: apigateway.JsonSchemaType.INTEGER,
            format: 'int64',
          },
          name: {
            description: 'Name of the pet',
            type: apigateway.JsonSchemaType.STRING,
          },
          status: {
            description: 'Status of the pet',
            type: apigateway.JsonSchemaType.STRING,
            enum: ['available', 'pending', 'sold'],
          },
        },
      },
    });
    // - array of pets
    const petArrayModel = api.addModel('PetArrayModel', {
      description: 'An array of pets',
      contentType: 'application/json',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'petArray',
        description: 'An array of pets',
        type: apigateway.JsonSchemaType.ARRAY,
        items: {
          modelRef: petModel,
        },
      },
    });
    // - new pet
    const newPetModel = api.addModel('NewPetModel', {
      description: 'Parameters for a new pet',
      contentType: 'application/json',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        title: 'newPet',
        description: 'Parameters for a new pet',
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          id: {
            description: 'ID of the new pet',
            type: apigateway.JsonSchemaType.INTEGER,
            format: 'int64',
          },
          name: {
            description: 'Name of the new pet',
            type: apigateway.JsonSchemaType.STRING,
          },
          tag: {
            description: 'Tag associated with the new pet',
            type: apigateway.JsonSchemaType.STRING,
          },
        },
        required: ['id', 'name'],
      },
    });

    // the root (/)
    // - GET
    api.root.addMethod(
      'GET',
      new apigateway.MockIntegration({
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "message": "You got it right."
              }`,
            },
          },
        ],
      }),
      {
        operationName: 'getRoot',
        summary: 'Get root',
        description: 'Returns the root object',
        requestValidator: fullRequestValidator,
        methodResponses: [
          {
            statusCode: '200',
          },
        ],
      },
    );
    // /pet
    const pet = api.root.addResource('pet');
    // - POST
    pet.addMethod(
      'POST',
      new apigateway.MockIntegration({
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `{
                "message": "Successfully added a new pet."
              }`
            },
          },
        ],
      }),
      {
        operationName: 'addNewPet',
        summary: 'Add pet',
        description: 'Adds a new pet to the store',
        requestValidator: fullRequestValidator,
        requestModels: {
          'application/json': newPetModel,
        },
        methodResponses: [
          {
            statusCode: '200',
            description: 'Successful operation',
          },
          {
            statusCode: '405',
            description: 'Invalid input',
          },
        ],
      },
    );
    // /pet/findByStatus
    const findByStatus = pet.addResource('findByStatus');
    // - GET
    findByStatus.addMethod(
      'GET',
      new apigateway.MockIntegration({
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': `[
                {
                  "id": 123,
                  "name": "Monaka",
                  "status": "sold"
                }
              ]`
            },
          },
        ],
      }),
      {
        operationName: 'findPetsByStatus',
        summary: 'Finds Pets by status',
        description: 'Multiple status values can be provided with comma separated strings',
        requestValidator: fullRequestValidator,
        requestParameterSchemas: {
          'method.request.querystring.status': {
            description: 'Status values that need to be considered for filter',
            required: false,
            explode: true,
            schema: {
              type: 'string',
              enum: ['available', 'pending', 'sold'],
              default: 'available',
            },
          },
        },
        methodResponses: [
          {
            statusCode: '200',
            description: 'successful operation',
            responseModels: {
              'application/json': petArrayModel,
            },
          },
        ],
      },
    );
  }
}
