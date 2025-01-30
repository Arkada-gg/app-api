import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsNotBlankConstraint implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value !== 'string') {
      return false;
    }
    if (value === '') {
      return true;
    }
    return value.trim().length > 0;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Поле не может быть пустым или состоять только из пробелов';
  }
}

export function IsNotBlank(validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isNotBlank',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: IsNotBlankConstraint,
    });
  };
}
