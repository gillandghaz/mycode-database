// Static picture of the editor for the hero. Purely decorative.
export default function EditorMock() {
  return (
    <div className="lp-win" aria-hidden="true">
      <div className="lp-win__bar"><i /><i /><i /><span>Main.java — my-projects</span></div>
      <div className="lp-win__body">
        <div className="lp-win__tree">
          <p>▾ my-projects</p>
          <p className="i1">▾ week-01</p>
          <p className="i2 on">Main.java</p>
          <p className="i2">Loops.java</p>
          <p className="i1">▸ week-02</p>
          <p className="i1">▸ exercises</p>
        </div>
        <pre className="lp-win__code">
<b className="k">public class</b> Main {"{"}{"\n"}
{"    "}<b className="k">public static void</b> main(String[] args) {"{"}{"\n"}
{"        "}<b className="k">for</b> (<b className="k">int</b> i = 1; i &lt;= 3; i++) {"{"}{"\n"}
{"            "}System.out.println(<b className="s">&quot;Hello #&quot;</b> + i);{"\n"}
{"        }"}{"\n"}
{"    }"}{"\n"}
{"}"}
        </pre>
      </div>
      <div className="lp-win__term">
        <span className="dim">$ run Main.java</span>{"\n"}
        Hello #1{"\n"}Hello #2{"\n"}Hello #3{"\n"}
        <span className="ok">✓ exited with code 0</span>
      </div>
    </div>
  );
}
