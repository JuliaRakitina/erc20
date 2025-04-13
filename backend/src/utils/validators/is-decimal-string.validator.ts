import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
} from 'class-validator';

export function IsDecimalString(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isDecimalString',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, _args: ValidationArguments) {
                    return (
                        typeof value === 'string' &&
                        /^\d+(\.\d+)?$/.test(value.trim())
                    );
                },
                defaultMessage() {
                    return 'Amount must be a valid decimal number (e.g. "10", "10.5")';
                },
            },
        });
    };
}
