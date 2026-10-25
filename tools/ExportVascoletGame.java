// @category Vascolet
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import java.io.*;

public class ExportVascoletGame extends GhidraScript {
    public void run() throws Exception {
        File out=new File(getScriptArgs()[0]); out.mkdirs();
        DecompInterface dec=new DecompInterface(); dec.openProgram(currentProgram);
        int ok=0,failed=0;
        try(PrintWriter index=new PrintWriter(new File(out,"index.tsv"),"UTF-8");
            PrintWriter functions=new PrintWriter(new File(out,"funciones.tsv"),"UTF-8")) {
            functions.println("address\tname\tsize");
            FunctionIterator it=currentProgram.getFunctionManager().getFunctions(true);
            while(it.hasNext()) {
                monitor.checkCancelled(); Function f=it.next(); long a=f.getEntryPoint().getOffset();
                functions.println(f.getEntryPoint()+"\t"+f.getName(true)+"\t"+f.getBody().getNumAddresses());
                if(a<0x401000 || a>=0x447000 || f.isThunk() || f.isExternal()) continue;
                DecompileResults r=dec.decompileFunction(f,12,monitor);
                index.println(f.getEntryPoint()+"\t"+f.getName(true)+"\t"+r.decompileCompleted()); index.flush();
                if(r.decompileCompleted()) {
                    try(PrintWriter w=new PrintWriter(new File(out,f.getEntryPoint()+".c"),"UTF-8")) {w.println(r.getDecompiledFunction().getC());}
                    ok++;
                } else failed++;
            }
        } finally {dec.dispose();}
        println("Game functions exported: "+ok+", failed: "+failed);
    }
}
