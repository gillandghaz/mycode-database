// Starter snippets (a small take on Programiz's "examples"). Java only for now.

export interface Template {
  key: string;
  label: string;
  code: (className: string) => string;
}

export const TEMPLATES: Template[] = [
  {
    key: "empty",
    label: "Empty class",
    code: (c) => `public class ${c} {\n\n}\n`,
  },
  {
    key: "hello",
    label: "Hello, World!",
    code: (c) =>
      `public class ${c} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`,
  },
  {
    key: "variables",
    label: "Variables & types",
    code: (c) =>
      `public class ${c} {\n    public static void main(String[] args) {\n        int age = 19;\n        double gpa = 3.75;\n        boolean active = true;\n        String name = "Ada";\n\n        System.out.println(name + " is " + age + " years old.");\n        System.out.println("GPA: " + gpa + ", active: " + active);\n    }\n}\n`,
  },
  {
    key: "loops",
    label: "Loops",
    code: (c) =>
      `public class ${c} {\n    public static void main(String[] args) {\n        for (int i = 1; i <= 5; i++) {\n            System.out.println("Square of " + i + " = " + (i * i));\n        }\n    }\n}\n`,
  },
  {
    key: "input",
    label: "Read input (Scanner)",
    code: (c) =>
      `import java.util.Scanner;\n\npublic class ${c} {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        System.out.print("Enter your name: ");\n        String name = in.nextLine();\n        System.out.println("Hello, " + name + "!");\n    }\n}\n`,
  },
];

export function getTemplate(key: string): Template {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
}
