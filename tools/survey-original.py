"""Capture every non-fill room of all five maps with the real Windows renderer."""
from pathlib import Path
import argparse,importlib.util,json,time
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('native_observe',ROOT/'tools/native-observe.py');native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)
def main():
    p=argparse.ArgumentParser();p.add_argument('--levels',nargs='*',default=['prehistory','egypt','castle','pirates','future']);args=p.parse_args()
    for level in args.levels:
        # The original uses a process-wide single-instance mutex. Wait for the
        # previous Job Object's asynchronous process termination to complete.
        time.sleep(.75)
        i=['prehistory','egypt','castle','pirates','future'].index(level)
        plan=[{'action':'wait','seconds':1}]
        plan.append({'action':'unlock','levels':5})
        plan.append({'action':'click','x':700,'y':85,'after':1})
        plan.append({'action':'click','x':100+150*i,'y':300,'after':1})
        plan.append({'action':'advanceIntros'})
        plan += [{'action':'wait','seconds':2},{'action':'capture','name':'entry'},{'action':'actors','name':level+'-actors'},{'action':'survey','level':level}]
        native.observe(plan,ROOT/f'analysis/native-reference/world/{level}')
if __name__=='__main__':main()
