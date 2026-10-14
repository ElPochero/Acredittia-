import sys

def resolve_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    out = []
    state = 'NORMAL' # HEAD, MVP
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            state = 'HEAD'
        elif line.startswith('======='):
            state = 'MVP'
        elif line.startswith('>>>>>>> origin/Dev_1_MVP'):
            state = 'NORMAL'
        else:
            if state == 'NORMAL' or state == 'MVP':
                out.append(line)
                
    with open(filepath, 'w') as f:
        f.writelines(out)

resolve_file('backend/app/routers/periodos_laborales.py')
